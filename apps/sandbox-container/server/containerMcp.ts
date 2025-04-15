import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { McpAgent } from 'agents/mcp'
import { z } from 'zod'

import { Env, Props } from '.'
import { OPEN_CONTAINER_PORT } from '../shared/consts'
import { ExecParams, FileList, FilePathParam, FilesWrite } from '../shared/schema'
import { MAX_CONTAINERS, proxyFetch, startAndWaitForPort } from './containerHelpers'
import { getContainerManager } from './containerManager'
import { BASE_INSTRUCTIONS } from './prompts'
import { fileToBase64 } from './utils'

export class ContainerMcpAgent extends McpAgent<Env, Props> {
	server = new McpServer(
		{
			name: 'Container MCP Agent',
			version: '1.0.0',
		},
		{ instructions: BASE_INSTRUCTIONS }
	)

	constructor(
		public ctx: DurableObjectState,
		public env: Env
	) {
		console.log('creating container DO')
		super(ctx, env)
	}

	async destroyContainer(): Promise<void> {
		await this.ctx.container?.destroy()
	}

	async killContainer(): Promise<void> {
		console.log('Reaping container')
		const containerManager = getContainerManager(this.env)
		const active = await containerManager.listActive()
		if (this.ctx.id.toString() in active) {
			console.log('killing container')
			await this.destroyContainer()
			await containerManager.killContainer(this.ctx.id.toString())
		}
	}

	async init() {
		this.server.tool(
			'container_initialize',
			'Start or reset the container',
			{},
			// @ts-ignore
			async ({}) => {
				return {
					content: [{ type: 'text', text: await this.container_initialize() }],
				}
			}
		)

		this.server.tool('container_ping', 'Ping the container for liveliness', {}, async ({}) => {
			return {
				content: [{ type: 'text', text: await this.container_ping() }],
			}
		})
		this.server.tool(
			'container_exec',
			'Run a command in a container and return the results from stdout',
			{ args: ExecParams },
			async ({ args }) => {
				return {
					content: [{ type: 'text', text: await this.container_exec(args) }],
				}
			}
		)
		//COURT: At some point we should split the tools into separate files
		this.server.tool(
			'container_file_delete',
			'Delete file and its contents',
			{ args: FilePathParam},
			async ({ args }) => {
				const deleted = await this.container_file_delete(args)
				return {
					content: [{ type: 'text', text: `File deleted: ${deleted}.`}]
				}
			}

		)
		this.server.tool(
			//TODO: make this file to be consistent with others
			'container_files_write',
			'Write file contents',
			{ args: FilesWrite },
			async ({ args }) => {
				return {
					content: [{ type: 'text', text: await this.container_files_write(args) }],
				}
			}
		)
		this.server.tool('container_files_list', 'List working directory file tree', {}, async ({}) => {
			const files = await this.container_ls()

			// this is a bit of a hack around the poor handling of resources in claude desktop
			const resources: {
				type: 'resource'
				resource: { uri: string; text: string; mimeType: string }
			}[] = files.resources.map((r) => {
				return {
					type: 'resource',
					resource: {
						uri: r.uri,
						text: r.uri,
						mimeType: 'text/plain',
					},
				}
			})

			return {
				content: resources,
			}
		})
		this.server.tool(
			'container_file_read',
			'Read a specific file',
			{ path: z.string() },
			async ({ path }) => {
				// normalize
				path = path.startsWith('file://') ? path.replace('file://', '') : path
				let { blob, mimeType } = await this.container_files_read(path)

				if (mimeType && (mimeType.startsWith('text') || mimeType === 'inode/directory')) {
					// this is because there isn't a "real" directory mime type, so we're reusing the "text/directory" mime type
					// so claude doesn't give an error
					mimeType = mimeType === 'inode/directory' ? 'text/directory' : mimeType

					// maybe "inode/directory" should list out multiple files in the contents list?
					return {
						content: [
							{
								type: 'resource',
								resource: {
									text: await blob.text(),
									uri: `file://${path}`,
									mimeType: mimeType,
								},
							},
						],
					}
				} else {
					return {
						content: [
							{
								type: 'resource',
								resource: {
									blob: await fileToBase64(blob),
									uri: `file://${path}`,
									mimeType: mimeType,
								},
							},
						],
					}
				}
			}
		)
	}

	async container_initialize(): Promise<string> {
		// kill container
		await this.killContainer()

		// try to cleanup cleanup old containers
		const containerManager = getContainerManager(this.env)

		if ((await containerManager.listActive()).length >= MAX_CONTAINERS) {
			await containerManager.tryKillOldContainers()
			if ((await containerManager.listActive()).length >= MAX_CONTAINERS) {
				throw new Error(
					`Unable to reap enough containers. There are ${MAX_CONTAINERS} active container sandboxes, please wait`
				)
			}
		}

		// start container
		let startedContainer = false
		await this.ctx.blockConcurrencyWhile(async () => {
			startedContainer = await startAndWaitForPort(
				this.env.ENVIRONMENT,
				this.ctx.container,
				OPEN_CONTAINER_PORT
			)
		})
		if (!startedContainer) {
			throw new Error('Failed to start container')
		}

		// track and manage lifecycle
		containerManager.trackContainer(this.ctx.id.toString())

		return `Created new container`
	}

	async container_ping(): Promise<string> {
		const res = await proxyFetch(
			this.env.ENVIRONMENT,
			this.ctx.container,
			new Request(`http://host:${OPEN_CONTAINER_PORT}/ping`),
			OPEN_CONTAINER_PORT
		)
		if (!res || !res.ok) {
			throw new Error(`Request to container failed: ${await res.text()}`)
		}
		return await res.text()
	}

	async container_exec(params: ExecParams): Promise<string> {
		const res = await proxyFetch(
			this.env.ENVIRONMENT,
			this.ctx.container,
			new Request(`http://host:${OPEN_CONTAINER_PORT}/exec`, {
				method: 'POST',
				body: JSON.stringify(params),
				headers: {
					'content-type': 'application/json',
				},
			}),
			OPEN_CONTAINER_PORT
		)
		if (!res || !res.ok) {
			throw new Error(`Request to container failed: ${await res.text()}`)
		}
		const txt = await res.text()
		return txt
	}

	async container_ls(): Promise<FileList> {
		const res = await proxyFetch(
			this.env.ENVIRONMENT,
			this.ctx.container,
			new Request(`http://host:${OPEN_CONTAINER_PORT}/files/ls`),
			OPEN_CONTAINER_PORT
		)
		if (!res || !res.ok) {
			throw new Error(`Request to container failed: ${await res.text()}`)
		}
		const json = (await res.json()) as FileList
		return json
	}

	//TODO: Abstract these
	async container_file_delete(filePath: string): Promise<boolean>{
		const res = await proxyFetch(
			this.env.ENVIRONMENT,
			this.ctx.container,
			new Request(`http://host:${OPEN_CONTAINER_PORT}/files/contents/${filePath}`, {
				method: 'DELETE'
			}),
			OPEN_CONTAINER_PORT
		)
		return res.ok
	}
	async container_files_read(
		filePath: string
	): Promise<{ blob: Blob; mimeType: string | undefined }> {
		const res = await proxyFetch(
			this.env.ENVIRONMENT,
			this.ctx.container,
			new Request(`http://host:${OPEN_CONTAINER_PORT}/files/contents/${filePath}`),
			OPEN_CONTAINER_PORT
		)
		if (!res || !res.ok) {
			throw new Error(`Request to container failed: ${await res.text()}`)
		}
		return {
			blob: await res.blob(),
			mimeType: res.headers.get('content-type') ?? undefined,
		}
	}

	async container_files_write(file: FilesWrite): Promise<string> {
		if (file.path.startsWith('file://')) {
			// normalize just in case the LLM sends the full resource URI
			file.path = file.path.replace('file://', '')
		}
		const res = await proxyFetch(
			this.env.ENVIRONMENT,
			this.ctx.container,
			new Request(`http://host:${OPEN_CONTAINER_PORT}/files/contents`, {
				method: 'POST',
				body: JSON.stringify(file),
				headers: {
					'content-type': 'application/json',
				},
			}),
			OPEN_CONTAINER_PORT
		)
		if (!res || !res.ok) {
			throw new Error(`Request to container failed: ${await res.text()}`)
		}
		return `Wrote file: ${file.path}`
	}
}
