/**
 * Resolves and invokes a method dynamically based on the provided slugs.
 *
 * This function traverses the object based on the `slugs` array, binds the method
 * to its correct context, and invokes it with the provided parameters.
 *
 * @param {Object} client - The root object (e.g., `client.radar.http`) to resolve methods from.
 * @param {string[]} path - The path to the desired method.
 * @param {Object} params - The parameters to pass when invoking the resolved method.
 * @returns {Promise<any>} The result of the method invocation.
 */
export async function resolveAndInvoke(client: any, path: string, params: any): Promise<any> {
	const slugs = path.split('/')
	const method = slugs.reduce((acc, key) => acc?.[key], client)
	const parentContext = slugs.slice(0, -1).reduce((acc, key) => acc?.[key], client)
	return await method.bind(parentContext)(params)
}
