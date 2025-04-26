import { McpAgent } from 'agents/mcp'

import { CloudflareMCPServer } from '@repo/mcp-common/src/server'

import { OPEN_CONTAINER_PORT } from '../shared/consts'
import { ExecParams, FilePathParam, FileWrite } from '../shared/schema'
import { MAX_CONTAINERS, proxyFetch, startAndWaitForPort } from './containerHelpers'
import { getContainerManager } from './containerManager'
import { BASE_INSTRUCTIONS } from './prompts'
import { fileToBase64, stripProtocolFromFilePath } from './utils'

import type { FileList } from '../shared/schema'
import type { Env } from './context'
import type { Props } from '.'

export class ContainerMcpAgent extends McpAgent<Env, {}, Props> {
	_server: CloudflareMCPServer | undefined
	set server(server: CloudflareMCPServer) {
		this._server = server
	}

	get server(): CloudflareMCPServer {
		if (!this._server) {
			throw new Error('Tried to access server before it was initialized')
		}

		return this._server
	}

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
		this.props.user.id
		this.server = new CloudflareMCPServer(
			this.props.user.id,
			this.env.MCP_METRICS,
			{
				name: this.env.MCP_SERVER_NAME,
				version: this.env.MCP_SERVER_VERSION,
			},
			{ instructions: BASE_INSTRUCTIONS }
		)

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
		this.server.tool(
			'container_file_delete',
			'Delete file and its contents',
			{ args: FilePathParam },
			async ({ args }) => {
				const path = await stripProtocolFromFilePath(args.path)
				const deleted = await this.container_file_delete(path)
				return {
					content: [{ type: 'text', text: `File deleted: ${deleted}.` }],
				}
			}
		)
		this.server.tool(
			'container_file_write',
			'Create a new file with the provided contents, overwriting the file if it already exists',
			{ args: FileWrite },
			async ({ args }) => {
				args.path = await stripProtocolFromFilePath(args.path)
				return {
					content: [{ type: 'text', text: await this.container_file_write(args) }],
				}
			}
		)
		this.server.tool('container_files_list', 'List working directory file tree', {}, async ({}) => {
			// This approach relies on resources, which aren't handled well by Claude right now. Until that's sorted, we can just use file read, since it lists all files in a directory if a directory is passed to it.
			//const files = await this.container_ls()

			// const resources: {
			// 	type: 'resource'
			// 	resource: { uri: string; text: string; mimeType: string }
			// }[] = files.resources.map((r) => {
			// 	return {
			// 		type: 'resource',
			// 		resource: {
			// 			uri: r.uri,
			// 			text: r.uri,
			// 			mimeType: 'text/plain',
			// 		},
			// 	}
			// })

			// return {
			// 	content: resources,
			// }

			// Begin workaround using container read rather than ls:
			const { blob, mimeType } = await this.container_file_read('.')
			return {
				content: [
					{
						type: 'resource',
						resource: {
							text: await blob.text(),
							uri: `file://`,
							mimeType: mimeType,
						},
					},
				],
			}
		})
		this.server.tool(
			'container_file_read',
			'Read a specific file or directory',
			{ args: FilePathParam },
			async ({ args }) => {
				const path = await stripProtocolFromFilePath(args.path)
				const { blob, mimeType } = await this.container_file_read(path)

				if (mimeType && mimeType.startsWith('text')) {
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

	async container_file_delete(filePath: string): Promise<boolean> {
		const res = await proxyFetch(
			this.env.ENVIRONMENT,
			this.ctx.container,
			new Request(`http://host:${OPEN_CONTAINER_PORT}/files/contents/${filePath}`, {
				method: 'DELETE',
			}),
			OPEN_CONTAINER_PORT
		)
		return res.ok
	}
	async container_file_read(
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
			mimeType: res.headers.get('Content-Type') ?? undefined,
		}
	}

	async container_file_write(file: FileWrite): Promise<string> {
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
