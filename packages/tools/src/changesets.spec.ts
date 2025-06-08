import { program } from '@commander-js/extra-typings'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { getPublishedPackages } from './changesets'

describe('getPublishedPackages', () => {
	const fixturesDir = path.join(__dirname, 'test/fixtures/changesets')
	const fixture = (name: string) => path.join(fixturesDir, name)

	beforeAll(() => {
		// throw errors instead of calling process.exit(1)
		// within program.error() is called by cliError()
		program.exitOverride((e) => {
			throw e
		})
	})
	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it('should read and parse valid published packages', async () => {
		vi.stubEnv('RUNNER_TEMP', fixture('valid'))

		const result = await getPublishedPackages()

		expect(result).toStrictEqual([
			{ name: 'package-a', version: '1.0.0' },
			{ name: 'package-b', version: '2.1.3' },
		])
	})

	it('should throw error when RUNNER_TEMP is not set', async () => {
		vi.stubEnv('RUNNER_TEMP', undefined)

		await expect(getPublishedPackages()).rejects.toThrowErrorMatchingInlineSnapshot(
			`[CommanderError: error: ✖ $RUNNER_TEMP is not set]`
		)
	})

	it('should throw error when RUNNER_TEMP is empty', async () => {
		vi.stubEnv('RUNNER_TEMP', '')

		await expect(getPublishedPackages()).rejects.toThrowErrorMatchingInlineSnapshot(
			`[CommanderError: error: ✖ $RUNNER_TEMP is empty]`
		)
	})

	it('should throw error when published packages file is not found', async () => {
		vi.stubEnv('RUNNER_TEMP', fixture('empty'))

		await expect(getPublishedPackages()).rejects.toThrowErrorMatchingInlineSnapshot(
			`[CommanderError: error: No published packages file found at: ${fixture('empty/published-packages.json')}]`
		)
	})

	it('should throw error when published packages JSON is invalid', async () => {
		vi.stubEnv('RUNNER_TEMP', fixture('invalid-json'))

		await expect(getPublishedPackages()).rejects.toThrowErrorMatchingInlineSnapshot(
			`[Error: Failed to parse published packages: SyntaxError: Unexpected token 'h', "this is not"... is not valid JSON]`
		)
	})

	it('should throw error when published packages schema is invalid', async () => {
		vi.stubEnv('RUNNER_TEMP', fixture('invalid-schema'))

		await expect(getPublishedPackages()).rejects.toThrowErrorMatchingInlineSnapshot(`
			[Error: Failed to parse published packages: ✖ Invalid input: expected string, received number
			  → at [0].version]
		`)
	})
})
