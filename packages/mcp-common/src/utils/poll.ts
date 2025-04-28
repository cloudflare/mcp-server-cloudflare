type PollOptions<T> = {
	taskFn: () => Promise<T>
	checkFn?: (result: T) => boolean
	intervalSeconds?: number
	maxWaitSeconds?: number
	onError?: (error: unknown) => void
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function pollUntilReady<T>({
	taskFn,
	checkFn = (result: T) => Boolean(result),
	intervalSeconds = 5,
	maxWaitSeconds = 60,
	onError = () => {},
}: PollOptions<T>): Promise<T> {
	let elapsed = 0
	let result: T | null = null

	while (elapsed < maxWaitSeconds) {
		try {
			result = await taskFn()
			if (checkFn(result)) break
		} catch (error) {
			onError(error)
		}

		await sleep(intervalSeconds * 1000)
		elapsed += intervalSeconds
	}

	if (result === null || !checkFn(result)) {
		throw new Error('Polling timed out or condition not met')
	}

	return result
}
