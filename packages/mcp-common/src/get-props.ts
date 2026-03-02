/**
 * Gets props from agent or throws if undefined
 */
export function getProps<T = unknown>(agent: { props?: T }): T {
	if (!agent.props) {
		throw new Error('Props required')
	}
	return agent.props
}
