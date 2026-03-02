import { DurableObject } from 'cloudflare:workers'

import { getEnv } from '@repo/mcp-common/src/env'
import { MetricsTracker } from '@repo/mcp-observability'

import { ContainerEvent } from './metrics'

import type { Env } from './sandbox.server.context'

const env = getEnv<Env>()
export class ContainerManager extends DurableObject<Env> {
	metrics = new MetricsTracker(env.MCP_METRICS, {
		name: env.MCP_SERVER_NAME,
		version: env.MCP_SERVER_VERSION,
	})

	constructor(
		public ctx: DurableObjectState,
		public env: Env
	) {
		super(ctx, env)
	}

	async trackContainer(id: string) {
		await this.ctx.storage.put(id, new Date())
	}

	async killContainer(id: string) {
		await this.ctx.storage.delete(id)
	}

	async tryKillOldContainers() {
		const activeContainers = await this.ctx.storage.list<Date>()
		for (const c of activeContainers) {
			const id = c[0]
			const now = new Date()
			const time = c[1]

			console.log(id, time, now, now.valueOf() - time.valueOf())

			// 15m timeout for container lifetime
			if (now.valueOf() - time.valueOf() > 15 * 60 * 1000) {
				await this.killContainer(id)
				// TODO: Figure out why we were running in to invalid durable object id the id does not match this durable object class error
				const doId = this.env.USER_CONTAINER.idFromString(id)
				const stub = this.env.USER_CONTAINER.get(doId)
				await stub.destroyContainer()
			}
		}
	}

	async listActive(): Promise<string[]> {
		const activeContainers = await this.ctx.storage.list()
		const activeIds: string[] = []
		for (const c of activeContainers.keys()) {
			activeIds.push(c)
		}

		this.metrics.logEvent(
			new ContainerEvent({
				active: activeIds.length,
			})
		)

		return activeIds
	}
}

export function getContainerManager(env: Env): DurableObjectStub<ContainerManager> {
	const id = env.CONTAINER_MANAGER.idFromName('manager')
	return env.CONTAINER_MANAGER.get(id)
}
