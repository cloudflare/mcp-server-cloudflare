import { McpAgent } from 'agents/mcp'

import { getProps } from '@repo/mcp-common/src/get-props'
import { CloudflareMCPServer } from '@repo/mcp-common/src/server'

import { ExecParams, FilePathParam, FileWrite } from '../shared/schema'
import { BASE_INSTRUCTIONS } from './prompts'
import { stripProtocolFromFilePath } from './utils'

import type { Props, UserContainer } from './sandbox.server.app'
import type { Env } from './sandbox.server.context'

export class ContainerMcpAgent extends McpAgent<Env, never, Props> {
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

	get userContainer(): DurableObjectStub<UserContainer> {
		const props = getProps(this)
		// TODO: Support account scoped tokens?
		if (props.type === 'account_token') {
			throw new Error('Container server does not currently support account scoped tokens')
		}
		const userContainer = this.env.USER_CONTAINER.idFromName(props.user.id)
		return this.env.USER_CONTAINER.get(userContainer)
	}

	constructor(
		public ctx: DurableObjectState,
		public env: Env
	) {
		console.log('creating container DO')
		super(ctx, env)
	}

	async init() {
		const props = getProps(this)
		// TODO: Probably we'll want to track account tokens usage through an account identifier at some point
		const userId = props.type === 'user_token' ? props.user.id : undefined

		this.server = new CloudflareMCPServer({
			userId,
			wae: this.env.MCP_METRICS,
			serverInfo: {
				name: this.env.MCP_SERVER_NAME,
				version: this.env.MCP_SERVER_VERSION,
			},
			options: { instructions: BASE_INSTRUCTIONS },
		})

		this.server.tool(
			'container_initialize',
			`Start or restart the container.
			Use this tool to initialize a container before running any python or node.js code that the user requests ro run.`,
			async () => {
				const props = getProps(this)
				if (props.type === 'account_token') {
					return {
						// TODO: Support account scoped tokens?
						// we'll need to add support for an account blocklist in that case
						content: [
							{
								type: 'text',
								text: 'Container server does not currently support account scoped tokens.',
							},
						],
					}
				}

				const userInBlocklist = await this.env.USER_BLOCKLIST.get(props.user.id)
				if (userInBlocklist) {
					return {
						content: [{ type: 'text', text: 'Blocked from intializing container.' }],
					}
				}
				return {
					content: [{ type: 'text', text: await this.userContainer.container_initialize() }],
				}
			}
		)

		this.server.tool(
			'container_ping',
			`Check if a container is running and responsive by sending a ping request. Use when the user wants to verify container health, troubleshoot connectivity issues, or confirm a service is alive before performing operations. Do not use when you need to query databases or manage cloud resources (use the appropriate d1_, r2_, or workers_ tools instead). Accepts `container_id` or `container_name` (required) and `timeout` (optional, in seconds). e.g., container_name="web-server" or container_id="abc123def456". Raises an error if the container does not exist or is not accessible. `container_id` or `container_name` (required) and `timeout` (optional, defaults to 5 seconds). e.g., container_name="web-server" or container_id="abc123def456". Returns error if the container does not exist or is not responding within the timeout period. Do not use when you need to inspect container details or logs (use container inspection tools instead).`,
			async () => {
				return {
					content: [{ type: 'text', text: await this.userContainer.container_ping() }],
				}
			}
		)
		this.server.tool(
			'container_exec',
			`Run a command in a container and return the results from stdout.
			If necessary, set a timeout. To debug, stream back standard error.
			If you're using python, ALWAYS use python3 alongside pip3`,
			{ args: ExecParams },
			async ({ args }) => {
				return {
					content: [{ type: 'text', text: await this.userContainer.container_exec(args) }],
				}
			}
		)
		this.server.tool(
			'container_file_delete',
			'Delete a file from the working directory of your Cloudflare project. Use when the user wants to remove unwanted files, clean up temporary files, or delete configuration files from their project workspace. Accepts `path` (required string) specifying the file location relative to the working directory, e.g., "src/config.json" or "temp/build.log". Raises an error if the file does not exist or cannot be accessed due to permissions. Do not use when you need to delete entire directories or multiple files at once. "config.json" or "src/components/old-header.js". Raises an error if the file does not exist or if you lack write permissions to the directory. Do not use when you need to delete entire directories or multiple files at once (use appropriate bulk operations instead).',
			{ args: FilePathParam },
			async ({ args }) => {
				const path = await stripProtocolFromFilePath(args.path)
				const deleted = await this.userContainer.container_file_delete(path)
				return {
					content: [{ type: 'text', text: `File deleted: ${deleted}.` }],
				}
			}
		)
		this.server.tool(
			'container_file_write',
			'Create a new file with specified contents in the working directory, overwriting any existing file at that path. Use when the user wants to save code, configuration files, or text content to the local filesystem. Accepts `filename` (required string) and `contents` (required string), e.g., filename="app.js", contents="console.log('Hello World');". Raises an error if the directory path does not exist or lacks write permissions. Do not use when you need to read existing file contents (use container_file_read instead)."config.json", contents='{"api_key": "abc123"}'. Raises an error if the directory path does not exist or lacks write permissions. Do not use when you need to append to an existing file without overwriting it.',
			{ args: FileWrite },
			async ({ args }) => {
				args.path = await stripProtocolFromFilePath(args.path)
				return {
					content: [{ type: 'text', text: await this.userContainer.container_file_write(args) }],
				}
			}
		)
		this.server.tool(
			'container_files_list',
			'List the file and directory structure of the current working directory. Use when the user wants to explore, browse, or inspect the contents and organization of files in the project workspace. Do not use when you need to read file contents or modify files (use appropriate file read/write tools instead). Accepts no parameters (`path` defaults to current directory). Returns a hierarchical tree view of all files and subdirectories, e.g., shows nested folders like "src/components/Button.js" and "docs/README.md". Raises an error if the current directory is inaccessible or permissions are denied. "src/components/Button.js" and "package.json" at root level. Fails if the working directory is inaccessible or permissions are denied.',
			async () => {
				// Begin workaround using container read rather than ls:
				const readFile = await this.userContainer.container_file_read('.')
				return {
					content: [
						{
							type: 'resource',
							resource: {
								text: readFile.type === 'text' ? readFile.textOutput : readFile.base64Output,
								uri: `file://`,
								mimeType: readFile.mimeType,
							},
						},
					],
				}
			}
		)
		this.server.tool(
			'container_file_read',
			'Read the contents of a specific file or directory from a container filesystem. Use when the user wants to examine file contents, display text files, or view images stored in the container. Do not use when you need to query database contents (use d1_database_query instead). Accepts `path` (required string) specifying the file or directory location, e.g., "/app/config.json" or "/var/log/". Raises an error if the path does not exist or access is denied. "/app/config.json" or "/var/log/application.log". Returns file contents as text or binary data for images that can be displayed to the user. Raises an error if the specified path does not exist or access is denied.',
			{ args: FilePathParam },
			async ({ args }) => {
				const path = await stripProtocolFromFilePath(args.path)
				const readFile = await this.userContainer.container_file_read(path)

				return {
					content: [
						{
							type: 'resource',
							resource: {
								...(readFile.type === 'text'
									? { text: readFile.textOutput }
									: { blob: readFile.base64Output }),
								uri: `file://${path}`,
								mimeType: readFile.mimeType,
							},
						},
					],
				}
			}
		)
	}
}
