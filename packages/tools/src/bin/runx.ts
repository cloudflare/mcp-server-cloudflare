import 'zx/globals'

import { program } from '@commander-js/extra-typings'
import { catchProcessError } from '@jahands/cli-tools'

import { deployPublishedWorkersCmd } from '../cmd/deploy-published-packages'

program
	.name('runx')
	.description('A CLI for scripts that automate this repo')

	// While `packages/tools/bin` scripts work well for simple tasks,
	// a typescript CLI is nicer for more complex things.

	.addCommand(deployPublishedWorkersCmd)

	// Don't hang for unresolved promises
	.hook('postAction', () => process.exit(0))
	.parseAsync()
	.catch(catchProcessError())
