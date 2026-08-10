import { Command } from '@commander-js/extra-typings'
import { validateArg } from '@jahands/cli-tools'
import z from 'zod'

import { getPublishedPackages } from '../changesets'

export const deployPublishedWorkersCmd = new Command('deploy-published-workers')
	.description(
		'Deploy Cloudflare Workers (based on which packages changesets marked as published in the release)'
	)
	.requiredOption(
		'-e, --env <staging|production>',
		'The environment to deploy to',
		validateArg(z.enum(['staging', 'production']))
	)
	.action(async ({ env }) => {
		const publishedPackages = await getPublishedPackages()

		// This technically includes all versioned packages (including non-Workers),
		// but that's fine because only Workers include a `deploy` package.json script.
		const filters = publishedPackages.flatMap((p) => ['-F', p.name]) satisfies string[]

		await $({
			verbose: true,
		})`turbo deploy ${filters} -- --env ${env}`
	})
