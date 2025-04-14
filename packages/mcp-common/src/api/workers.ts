import type { Cloudflare } from 'cloudflare'

/**
 * Fetches list of workers from Cloudflare API
 * @param client Cloudflare API Client
 * @param accountId Cloudflare account ID
 * @returns List of workers
 */
export async function handleWorkersList({
	client,
	accountId,
}: {
	client: Cloudflare
	accountId: string
}): Promise<Cloudflare.Workers.Scripts.Script[]> {
	return (await client.workers.scripts.list({ account_id: accountId })).result
}

/**
 * Downloads a specific worker script from Cloudflare API
 * @param client Cloudflare API Client
 * @param scriptName Name of the worker script to download
 * @param accountId Cloudflare account ID
 * @returns The worker script content
 */
export async function handleWorkerScriptDownload({
	client,
	scriptName,
	accountId,
}: {
	client: Cloudflare
	scriptName: string
	accountId: string
}): Promise<string> {
	return await client.workers.scripts.get(scriptName, { account_id: accountId })
}
