import type { ZodSchema } from 'zod'

export type DurableKVStorageKeys = { [key: string]: ZodSchema }

/**
 * DurableKVStore is a type-safe key/value store backed by Durable Object storage.
 *
 * @example
 *
 * ```ts
 * export class MyDurableObject extends DurableObject<Bindings> {
 * 	readonly kv
 * 	constructor(
 * 		readonly state: DurableObjectState,
 * 		env: Bindings
 * 	) {
 * 		super(state, env)
 * 		this.kv = new DurableKVStore({
 * 			state,
 * 			prefix: 'meta',
 * 			keys: {
 * 				// Each key has a matching Zod schema enforcing what's stored
 * 				date_key: z.coerce.date(),
 * 				// While empty keys will always return null, adding
 * 				// `nullable()` allows us to explicitly set it to null
 * 				string_key: z.string().nullable(),
 * 				number_key: z.number(),
 * 			} as const satisfies StorageKeys,
 * 		})
 * 	}
 *
 * 	async example(): Promise<void> {
 * 		await this.kv.get('number_key') // -> null
 * 		this.kv.put('number_key', 5)
 * 		await this.kv.get('number_key') // -> 5
 * 	}
 * }
 *	```
 */
export class DurableKVStore<T extends DurableKVStorageKeys> {
	private readonly prefix: string
	private readonly keys: T
	private readonly state: DurableObjectState

	constructor({ state, prefix, keys }: { state: DurableObjectState; prefix: string; keys: T }) {
		this.state = state
		this.prefix = prefix
		this.keys = keys
	}

	/** Add the prefix to a key (used for get/put operations) */
	private addPrefix<K extends keyof T>(key: K): string {
		if (this.prefix.length > 0) {
			return `${this.prefix}/${key.toString()}`
		}
		return key.toString()
	}

	/**
	 * Get a value from KV storage. Returns `null` if the value
	 * is not set (or if it's explicitly set to `null`)
	 */
	async get<K extends keyof T>(key: K): Promise<T[K]['_output'] | null>
	/**
	 * Get a value from KV storage or return the provided
	 * default if they value in storage is unset (undefined).
	 * The default value must match the schema for the given key.
	 *
	 * If defaultValue is explicitly set to undefined, it will still return null (avoid this).
	 *
	 * If the value in storage is null then this will return null instead of the default.
	 */
	async get<K extends keyof T>(key: K, defaultValue: T[K]['_output']): Promise<T[K]['_output']>
	async get<K extends keyof T>(
		key: K,
		defaultValue?: T[K]['_output']
	): Promise<T[K]['_output'] | null> {
		const schema = this.keys[key]
		if (schema === undefined) {
			throw new TypeError(`key ${key.toString()} has no matching schema`)
		}

		const res = await this.state.storage.get(this.addPrefix(key))
		if (res === undefined) {
			if (defaultValue !== undefined) {
				return schema.parse(defaultValue)
			}
			return null
		}

		return schema.parse(res)
	}

	/** Write value to KV storage */
	put<K extends keyof T>(key: K, value: T[K]['_input']): void {
		const schema = this.keys[key]
		if (schema === undefined) {
			throw new TypeError(`key ${key.toString()} has no matching schema`)
		}
		const parsedValue = schema.parse(value)
		void this.state.storage.put(this.addPrefix(key), parsedValue)
	}

	/**
	 * Delete value in KV storage. **Does not need to be awaited**
	 *
	 * @returns `true` if a value was deleted, or `false` if it did not.
	 */
	async delete<K extends keyof T>(key: K): Promise<boolean> {
		return this.state.storage.delete(this.addPrefix(key))
	}
}
