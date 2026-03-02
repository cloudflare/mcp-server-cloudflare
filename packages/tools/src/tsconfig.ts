import { inspect } from 'node:util'

import type {
	convertCompilerOptionsFromJson,
	createProgram,
	readConfigFile,
	sys,
	CompilerOptions as TSCompilerOptions,
} from 'typescript'

export type { TSCompilerOptions }

interface TSModule {
	readConfigFile: typeof readConfigFile
	convertCompilerOptionsFromJson: typeof convertCompilerOptionsFromJson
	sys: typeof sys
	createProgram: typeof createProgram
}

/**
 * TypeScript helpers. This is a class so that we can dynamically import the TypeScript module
 * to reduce runx start time for commands that don't use the typescript package.
 *
 * @example
 *
 * ```ts
 * const tsHelpers = await new TSHelpers().init()
 * const { ts } = tsHelpers
 * const tsConfig = tsHelpers.getTSConfig()
 * ts.createProgram(entryPoints, tsConfig).emit()
 * ```
 */
export class TSHelpers {
	#ts: TSModule | undefined
	public get ts(): TSModule {
		if (!this.#ts) {
			throw new Error('TSHelpers not initialized. Call init() first.')
		}
		return this.#ts
	}

	async init(): Promise<TSHelpers> {
		this.#ts = (await import('typescript')) as TSModule
		return this
	}

	getTSConfig(configPath = 'tsconfig.json'): TSCompilerOptions {
		const jsonCompopts = this.getCompilerOptionsJSONFollowExtends(configPath)
		const tmp = this.ts.convertCompilerOptionsFromJson(jsonCompopts, '')
		if (tmp.errors.length > 0) {
			throw new Error(`failed parse config: ${inspect(tmp)}`)
		}
		const tsCompopts: TSCompilerOptions = tmp.options
		return tsCompopts
	}

	getCompilerOptionsJSONFollowExtends(configPath: string): {
		[key: string]: unknown
	} {
		let compopts = {}
		const config = this.ts.readConfigFile(configPath, this.ts.sys.readFile).config
		if (config.extends !== undefined) {
			const rqrpath = require.resolve(config.extends)
			compopts = this.getCompilerOptionsJSONFollowExtends(rqrpath)
		}
		return {
			...compopts,
			...config.compilerOptions,
		}
	}
}
