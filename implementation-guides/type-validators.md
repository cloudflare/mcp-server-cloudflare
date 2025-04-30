# MCP Tool Type Validator Implementation Guide

This guide outlines the best practices for creating Zod validators for the parameters of MCP (Model Context Protocol) tools, particularly those interacting with Cloudflare resources via the Cloudflare Typescript SDK.

## Purpose

Zod validators serve several critical functions:

1.  **Runtime Validation:** They ensure that the arguments provided to tools (often by an LLM) match the expected format, constraints, and types before the tool logic executes or interacts with external APIs (like the Cloudflare SDK).
2.  **Type Safety:** They provide strong typing for tool parameters within the TypeScript codebase.
3.  **Schema Definition:** They act as a clear, machine-readable definition of a tool's expected inputs, aiding both developers and LLMs in understanding how to use the tool correctly.
4.  **SDK Alignment:** They help maintain alignment with underlying SDKs, catching potential breaking changes.

## Core Principles

### 1. Link to SDK Types with `z.ZodType`

When a tool parameter corresponds directly to a parameter in the Cloudflare Node SDK (`cloudflare/resources/...`), **always** link your Zod schema to the SDK type using `z.ZodType<SDKType>`. This creates a compile-time dependency.

**Why?**

- **Detect SDK Changes:** If the underlying SDK type changes (e.g., type alias renamed, property added/removed/renamed, type changed from `string` to `string | null`), your Zod schema definition will likely cause a TypeScript error during compilation. This immediately flags the need to update the validator and potentially the tool logic, preventing runtime errors caused by SDK misalignment.
- **Accuracy:** Ensures your validator accurately reflects the type expected by the SDK function you intend to call.

**Example (`hyperdrive.ts`):**

```typescript
import { z } from 'zod'

import type { ConfigCreateParams } from 'cloudflare/resources/hyperdrive/configs.mjs'

/** Zod schema for a Hyperdrive config name. */
export const HyperdriveConfigNameSchema: z.ZodType<ConfigCreateParams['name']> = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[a-zA-Z0-9_-]+$/)
	.describe('The name of the Hyperdrive configuration (alphanumeric, underscore, hyphen)')

/** Zod schema for the origin database host (IPv4). */
export const HyperdriveOriginHostSchema: z.ZodType<ConfigCreateParams.PublicDatabase['host']> = z
	.string()
	.ip({ version: 'v4' })
	.describe('The database host IPv4 address')
```

### 2. Define Individual Validators Per Field (Avoid Object Schemas for Tool Parameters)

Define a separate, named Zod schema for **each individual field** that a tool might accept as a parameter. Do **not** group multiple parameters into a single Zod object schema (`z.object({...})`) that the tool accepts as a single `params` argument.

**Why?**

- **LLM Clarity:** LLMs generally understand and handle distinct, named parameters better than complex nested objects. Providing individual schemas makes the tool's signature clearer for the LLM to interpret and use correctly.
- **Reusability:** Individual field schemas (like `HyperdriveConfigIdSchema`, `HyperdriveConfigNameSchema`) can be reused across different tools (e.g., `hyperdrive_create`, `hyperdrive_update`, `hyperdrive_get`).
- **Modularity:** Easier to manage, update, and test individual validation rules.

**Example (`hyperdrive.ts` Structure):**

```typescript
// --- Base Field Schemas ---
export const HyperdriveConfigIdSchema = z.string().describe(...);
export const HyperdriveConfigNameSchema: z.ZodType<...> = z.string()...describe(...);
export const HyperdriveOriginHostSchema: z.ZodType<...> = z.string()...describe(...);
export const HyperdriveOriginPortSchema: z.ZodType<...> = z.number()...describe(...);
// ... other individual fields
```

**Conceptual Tool Definition (Illustrative):**

Instead of:

```typescript
// DON'T DO THIS for tool params
const CreateParamsSchema = z.object({
	name: HyperdriveConfigNameSchema,
	host: HyperdriveOriginHostSchema,
	port: HyperdriveOriginPortSchema,
	// ... other fields
})

// Tool definition would accept one arg: { params: CreateParamsSchema }
```

Do:

```typescript
// DO THIS: Tool definition accepts multiple named args
// tool('hyperdrive_create', {
//     name: HyperdriveConfigNameSchema,
//     host: HyperdriveOriginHostSchema,
//     port: HyperdriveOriginPortSchema,
//     // ... other named parameters with their individual schemas
// }, ...)
```

### 3. Use `.describe()` Extensively

Add a clear, concise `.describe('...')` call to **every** Zod schema you define.

**Why?**

- **LLM Context:** The description is often extracted and provided to the LLM as part of the tool's definition, helping it understand the purpose and constraints of each parameter.
- **Developer Documentation:** Serves as inline documentation for developers working with the code.

**Example (`hyperdrive.ts`):**

```typescript
/** Zod schema for the list page number. */
export const HyperdriveListParamPageSchema = z
	.number()
	.int()
	.positive()
	.optional()
	.describe('Page number of results') // <-- Good description!
```

## Naming Conventions

Use a consistent naming convention for your validator schemas. A recommended pattern is:

`ServiceNameFieldNameSchema`

- `ServiceName`: The Cloudflare service (e.g., `Hyperdrive`, `KV`, `D1`, `R2`).
- `FieldName`: The specific field being validated (e.g., `ConfigId`, `ConfigName`, `OriginHost`, `ListParamPage`).
- `Schema`: Suffix indicating it's a Zod schema.

**Examples:**

- `HyperdriveConfigIdSchema`
- `KVKeySchema`
- `D1DatabaseIdSchema`
- `R2BucketNameSchema`

## Location

Place validators related to a specific service or concept in dedicated files within the `packages/mcp-common/src/types/` directory (e.g., `hyperdrive.ts`, `kv.ts`).

## Summary

By following these principles – linking to SDK types, using granular named validators, providing clear descriptions, and maintaining consistent naming – you create robust, maintainable, and LLM-friendly type validation for MCP tools.
