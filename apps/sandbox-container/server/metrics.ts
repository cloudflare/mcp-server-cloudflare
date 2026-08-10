import { MetricsEvent, MetricsEventIndexIds } from '@repo/mcp-observability'

export class ContainerEvent extends MetricsEvent {
	constructor(
		private containers: {
			active?: number
		}
	) {
		super()
	}

	toDataPoint(): AnalyticsEngineDataPoint {
		return {
			indexes: [MetricsEventIndexIds.CONTAINER_MANAGER],
			doubles: this.mapDoubles({
				double1: this.containers.active,
			}),
		}
	}
}
