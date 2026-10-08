import { DurableObject } from 'cloudflare:workers'
import mime from 'mime'

import { getContainerManager, MAX_CONTAINERS } from './containerManager'
import { bytesToBase64, toWorkdirPath } from './utils'

import type { ExecParams, FileWrite } from '../shared/schema'
import type { Env } from './sandbox.server.context'

/** Where commands run and file paths resolve. The image creates it. */
const WORKDIR = '/workdir'
/** Matches the old application's instance size: 1/16 vCPU, 256 MiB, 2 GB disk. */
const INSTANCE = 'lite'
/** Stop a container nobody has used for this long. The ContainerManager reaps at 15 minutes. */
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000
const DEFAULT_EXEC_TIMEOUT_MS = 2 * 60 * 1000
const MAX_EXEC_TIMEOUT_MS = 10 * 60 * 1000
/** exec() processes get only PATH from the image, so give them the rest of a usual shell. */
const EXEC_ENV = { HOME: '/root', LANG: 'C.UTF-8' }
/** There is no MIME type for a directory; Claude accepts this one. */
const DIRECTORY_CONTENT_TYPE = 'text/directory'
const START_ATTEMPTS = 20
const START_RETRY_DELAY_MS = 500

type RunResult = { exitCode: number; stdout: Uint8Array; stderr: string }
type FileContents =
	| { type: 'text'; textOutput: string; mimeType: string | undefined }
	| { type: 'base64'; base64Output: string; mimeType: string | undefined }

/** Decode bytes as UTF-8, or undefined if they aren't valid UTF-8 (so are likely binary). */
function decodeUtf8(bytes: Uint8Array): string | undefined {
	try {
		return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)
	} catch {
		return undefined
	}
}

export class UserContainer extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
		// A Durable Object restart drops the timeout, so set it again on a container that kept running.
		const container = ctx.container
		if (container?.running) {
			void ctx.blockConcurrencyWhile(() => container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS))
		}
	}

	async destroyContainer(): Promise<void> {
		if (this.ctx.container?.running) {
			await this.ctx.container.destroy()
		}
	}

	async killContainer(): Promise<void> {
		await this.destroyContainer()
		await getContainerManager(this.env).killContainer(this.ctx.id.toString())
	}

	async container_initialize(): Promise<string> {
		await this.killContainer()

		// The durable_object scheduling policy has no max_instances, so the manager enforces the cap.
		const containerManager = getContainerManager(this.env)
		if ((await containerManager.listActive()).length >= MAX_CONTAINERS / 2) {
			await containerManager.tryKillOldContainers()
			if ((await containerManager.listActive()).length >= MAX_CONTAINERS) {
				throw new Error(
					`Unable to reap enough containers. There are ${MAX_CONTAINERS} active container sandboxes, please wait`
				)
			}
		}

		await this.ctx.blockConcurrencyWhile(() => this.startContainer())
		await containerManager.trackContainer(this.ctx.id.toString())

		return 'Created new container'
	}

	async container_ping(): Promise<string> {
		await this.run(['true'])
		return 'pong!'
	}

	async container_exec(params: ExecParams): Promise<string> {
		const timeoutMs = Math.min(params.timeout ?? DEFAULT_EXEC_TIMEOUT_MS, MAX_EXEC_TIMEOUT_MS)
		const result = await this.run(['sh', '-c', params.args], {
			timeoutMs,
			stderr: params.streamStderr ? 'combined' : 'ignore',
		})
		if (result === 'timeout') {
			return `Process killed after ${timeoutMs}ms timeout`
		}
		return `${new TextDecoder().decode(result.stdout)}Process exited with code: ${result.exitCode}`
	}

	async container_file_delete(filePath: string): Promise<boolean> {
		const result = await this.runOrThrow(['rm', '-r', '--', toWorkdirPath(filePath)])
		return result.exitCode === 0
	}

	async container_file_read(filePath: string): Promise<FileContents> {
		const path = toWorkdirPath(filePath)
		const kind = new TextDecoder()
			.decode(
				(
					await this.runOrThrow([
						'sh',
						'-c',
						'if [ -d "$1" ]; then echo dir; elif [ -f "$1" ]; then echo file; fi',
						'sh',
						path,
					])
				).stdout
			)
			.trim()

		if (kind === 'dir') {
			const listing = await this.runOrThrow(['find', path, '-mindepth', '1', '-maxdepth', '1'])
			const uris = new TextDecoder()
				.decode(listing.stdout)
				.split('\n')
				.filter(Boolean)
				.map((entry) => `file:///${entry.replace(/^\.\//, '')}`)
				.sort()
			return { type: 'text', textOutput: uris.join('\n'), mimeType: DIRECTORY_CONTENT_TYPE }
		}
		if (kind !== 'file') {
			throw new Error(`No such file or directory: ${filePath}`)
		}

		const contents = await this.runOrThrow(['cat', '--', path])
		if (contents.exitCode !== 0) {
			throw new Error(`Failed to read ${filePath}: ${contents.stderr}`)
		}
		const mimeType = mime.getType(path) ?? undefined
		const text =
			mimeType === undefined || mimeType.startsWith('text')
				? decodeUtf8(contents.stdout)
				: undefined
		if (text !== undefined) {
			return { type: 'text', textOutput: text, mimeType: mimeType ?? 'text/plain' }
		}
		return { type: 'base64', base64Output: bytesToBase64(contents.stdout), mimeType }
	}

	async container_file_write(file: FileWrite): Promise<string> {
		const result = await this.runOrThrow(
			['sh', '-c', 'mkdir -p "$(dirname "$1")" && cat > "$1"', 'sh', toWorkdirPath(file.path)],
			{ stdin: file.text }
		)
		if (result.exitCode !== 0) {
			throw new Error(`Failed to write ${file.path}: ${result.stderr}`)
		}
		return `Wrote file: ${file.path}`
	}

	private requireContainer(): Container {
		const container = this.ctx.container
		if (!container) {
			throw new Error('ctx.container is undefined. Is UserContainer bound to a container?')
		}
		return container
	}

	/**
	 * Start a container and wait until it runs commands. A container can be briefly unavailable
	 * after destroy(), and start() returns before the container is ready, so both are retried.
	 */
	private async startContainer(): Promise<void> {
		const container = this.requireContainer()
		let lastError: unknown
		for (let attempt = 0; attempt < START_ATTEMPTS; attempt++) {
			try {
				if (!container.running) {
					// The old @cloudflare/workers-types that agents pulls in also declares
					// ContainerStartupOptions, without `image`, and wins the merge.
					container.start({
						image: container.images.sandbox,
						instance: INSTANCE,
						enableInternet: true,
					} as ContainerStartupOptions)
					this.ctx.waitUntil(
						container.monitor().catch((error) => console.error('Container exited', error))
					)
				}
				await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS)
				await this.runOrThrow(['true'])
				return
			} catch (error) {
				lastError = error
				await new Promise((resolve) => setTimeout(resolve, START_RETRY_DELAY_MS))
			}
		}
		throw new Error(`Failed to start container: ${String(lastError)}`)
	}

	private async runOrThrow(
		cmd: string[],
		options: { stdin?: string; timeoutMs?: number } = {}
	): Promise<RunResult> {
		const result = await this.run(cmd, options)
		if (result === 'timeout') {
			throw new Error(`Timed out running ${cmd[0]}`)
		}
		return result
	}

	/** Run a process in WORKDIR and collect its output, killing it after timeoutMs. */
	private async run(
		cmd: string[],
		{
			stdin,
			timeoutMs = DEFAULT_EXEC_TIMEOUT_MS,
			stderr = 'pipe',
		}: { stdin?: string; timeoutMs?: number; stderr?: 'pipe' | 'combined' | 'ignore' } = {}
	): Promise<RunResult | 'timeout'> {
		const container = this.requireContainer()
		if (!container.running) {
			throw new Error('Container is not running. Call container_initialize first.')
		}

		// Docs: pass an AbortController's signal, not AbortSignal.timeout(), and stop it once the
		// process exits.
		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), timeoutMs)
		try {
			const proc = await container.exec(cmd, {
				cwd: WORKDIR,
				env: EXEC_ENV,
				stdin: stdin === undefined ? undefined : new Blob([stdin]).stream(),
				stdout: 'pipe',
				stderr,
				signal: controller.signal,
			})
			const output = await proc.output()
			// Aborting sends SIGKILL; the process then exits with 137 instead of rejecting.
			if (controller.signal.aborted) {
				return 'timeout'
			}
			return {
				exitCode: output.exitCode,
				stdout: new Uint8Array(output.stdout),
				stderr: new TextDecoder().decode(output.stderr),
			}
		} catch (error) {
			if (controller.signal.aborted) {
				return 'timeout'
			}
			throw error
		} finally {
			clearTimeout(timer)
		}
	}
}
