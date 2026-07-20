import { z } from 'zod'

import { requireRequestProps } from '@repo/mcp-common/src/request-context'

import { ExecParams, FilePathParam, FileWrite } from '../shared/schema'
import { stripProtocolFromFilePath } from './utils'

import type { McpRegistrationContext } from '@repo/mcp-common/src/request-context'
import type { Env } from './sandbox.server.context'
import type { UserContainer } from './userContainer'

function getUserContainer(context: McpRegistrationContext<Env>): DurableObjectStub<UserContainer> {
	const props = requireRequestProps(context)
	if (props.type === 'account_token') {
		throw new Error('Container server does not currently support account-scoped tokens')
	}
	const id = context.env.USER_CONTAINER.idFromName(props.user.id)
	return context.env.USER_CONTAINER.get(id)
}

/** Registers request-local protocol handlers backed by the preserved per-user container DO. */
export function registerContainerTools(context: McpRegistrationContext<Env>) {
	context.server.registerTool(
		'container_initialize',
		{
			description: `Start or restart the container.
Use this tool to initialize a container before running any Python or Node.js code that the user requests to run.`,
		},
		async () => {
			const props = requireRequestProps(context)
			if (props.type === 'account_token') {
				return {
					content: [
						{
							type: 'text',
							text: 'Container server does not currently support account-scoped tokens.',
						},
					],
				}
			}

			const userInBlocklist = await context.env.USER_BLOCKLIST.get(props.user.id)
			if (userInBlocklist) {
				return { content: [{ type: 'text', text: 'Blocked from initializing container.' }] }
			}
			return {
				content: [{ type: 'text', text: await getUserContainer(context).container_initialize() }],
			}
		}
	)

	context.server.registerTool(
		'container_ping',
		{ description: 'Ping the container for liveliness. Use this to check if it is running.' },
		async () => ({
			content: [{ type: 'text', text: await getUserContainer(context).container_ping() }],
		})
	)

	context.server.registerTool(
		'container_exec',
		{
			description: `Run a command in a container and return stdout.
If necessary, set a timeout. To debug, stream back standard error. For Python, always use python3 and pip3.`,
			inputSchema: z.object({ args: ExecParams }),
		},
		async ({ args }) => ({
			content: [{ type: 'text', text: await getUserContainer(context).container_exec(args) }],
		})
	)

	context.server.registerTool(
		'container_file_delete',
		{
			description: 'Delete a file in the working directory.',
			inputSchema: z.object({ args: FilePathParam }),
		},
		async ({ args }) => {
			const path = await stripProtocolFromFilePath(args.path)
			const deleted = await getUserContainer(context).container_file_delete(path)
			return { content: [{ type: 'text', text: `File deleted: ${deleted}.` }] }
		}
	)

	context.server.registerTool(
		'container_file_write',
		{
			description:
				'Create a file with the provided contents in the working directory, overwriting it if it exists.',
			inputSchema: z.object({ args: FileWrite }),
		},
		async ({ args }) => {
			const file = { ...args, path: await stripProtocolFromFilePath(args.path) }
			return {
				content: [
					{ type: 'text', text: await getUserContainer(context).container_file_write(file) },
				],
			}
		}
	)

	context.server.registerTool(
		'container_files_list',
		{
			description: 'List the working-directory file tree.',
		},
		async () => {
			const readFile = await getUserContainer(context).container_file_read('.')
			return {
				content: [
					{
						type: 'resource',
						resource: {
							...(readFile.type === 'text'
								? { text: readFile.textOutput }
								: { blob: readFile.base64Output }),
							uri: 'file://',
							mimeType: readFile.mimeType,
						},
					},
				],
			}
		}
	)

	context.server.registerTool(
		'container_file_read',
		{
			description:
				'Read a file or directory, returning text or a displayable base64 resource with its MIME type.',
			inputSchema: z.object({ args: FilePathParam }),
		},
		async ({ args }) => {
			const path = await stripProtocolFromFilePath(args.path)
			const readFile = await getUserContainer(context).container_file_read(path)
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
