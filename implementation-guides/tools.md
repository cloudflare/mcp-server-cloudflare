# MCP Tool Implementation Guide

This guide explains how to implement and register tools within an MCP (Model Context Protocol) server, enabling AI models to interact with external systems, APIs, or specific functionalities like Cloudflare services.

## Purpose of Tools

Tools are the mechanism by which an MCP agent (powered by an LLM) can perform actions beyond generating text. They allow the agent to accomplish many tasks, including:

- Interact with APIs (e.g., Cloudflare API, other REST APIs).
- Query databases or vector stores (like Autorag).
- Access environment resources (KV, R2, D1, Service Bindings).
- Perform specific computations or data transformations.

## Registering a Tool

Tools are registered using the `agent.server.tool()` method.

```typescript
// Import your Zod schemas
import { z } from 'zod'

import { getCloudflareClient } from '../cloudflare-api'
import { MISSING_ACCOUNT_ID_RESPONSE } from '../constants'
import { type CloudflareMcpAgent } from '../types/cloudflare-mcp-agent'
import { KvNamespaceIdSchema, KvNamespaceTitleSchema } from '../types/kv_namespace'

export function registerMyServiceTools(agent: CloudflareMcpAgent) {
	agent.server.tool(
		'tool_name', // String: Unique name for the tool
		'Detailed description', // String: Description for the LLM (CRITICAL!)
		{
			// Object: Parameter definitions using Zod schemas
			param1: MyParam1Schema,
			param2: MyParam2Schema.optional(),
			// ... other parameters
		},
		async (params) => {
			// Async Function: The implementation logic
			// params contains the validated parameters { param1, param2, ... }

			// --- Tool Logic Start ---
			try {
				// Access agent context if needed (e.g., account ID, credentials)
				const account_id = await agent.getActiveAccountId()
				if (!account_id) {
					return MISSING_ACCOUNT_ID_RESPONSE // Handle missing context
				}

				// Perform the action (e.g., call SDK, query DB)
				// const client = getCloudflareClient(agent.props.accessToken);
				// const result = await client.someService.someAction(...);

				// Format the successful response
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true /*, result */ }),
						},
						// Or potentially EmbeddedResource for richer data
					],
				}
			} catch (error) {
				// Format the error response
				return {
					content: [
						{
							type: 'text',
							text: `Error performing action: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
			// --- Tool Logic End ---
		}
	)

	// ... register other tools ...
}
```

### Key Components:

1.  **`toolName` (string):**

    - A unique identifier for the tool.
    - **Convention:** Use `snake_case`. Typically `service_noun_verb` (e.g., `kv_namespace_create`, `hyperdrive_config_list`, `docs_search`).

2.  **`description` (string - Max 1024 chars):**

    - **This is the MOST CRITICAL part for LLM interaction.** The LLM uses this description _exclusively_ to decide _when_ to use the tool and _what_ it does.
    - **A good description should include:**
      - **Core Purpose:** What does the tool _do_? (e.g., "List Hyperdrive configurations", "Search Cloudflare documentation").
      - **When to Use:** Provide clear scenarios or user intents that should trigger this tool. Use bullet points or clear instructions. (e.g., "Use this when a user asks to see their Hyperdrive setups", "Use this tool when: a user asks about Cloudflare products; you need info on a feature; you are unsure how to use Cloudflare functionality; you are writing Workers code and need docs").
      - **Inputs:** Briefly mention key inputs if not obvious from parameter names.
      - **Outputs:** Briefly describe what the tool returns (e.g., "Returns a list of namespace objects", "Returns search results as embedded resources").
      - **Example Workflows/Follow-ups (Optional but helpful):** Suggest how this tool fits into a larger task or what tools might be used next (e.g., "After creating a namespace with `kv_namespace_create`, you might bind it to a Worker.", "Use `hyperdrive_config_get` to view details before using `hyperdrive_config_edit`.").
    - **Be specific and unambiguous.** Avoid jargon unless it's essential domain terminology the LLM should understand.
    - **Keep it concise** while conveying necessary information.

3.  **`parameters` (object):**

    - An object mapping parameter names (keys) to their corresponding Zod schemas (values).
    - Follow the principles outlined in the `implementation-guides/type-validators.md` guide

4.  **`handlerFunction` (async function):**
    - The asynchronous function that executes the tool's logic.
    - It receives a single argument: an object (`params`) containing the validated parameters passed by the LLM, matching the keys defined in the `parameters` object.
    - **Implementation Details:**
      - **Access Context:** Use `agent.getActiveAccountId()`, `agent.props.accessToken`, `agent.env` (for worker bindings like AI, D1, R2) to get necessary credentials, environment variables, or bindings.
      - **Error Handling:** Wrap the core logic in a `try...catch` block to gracefully handle failures (e.g., API errors, network issues, invalid inputs not caught by Zod).
      - **Perform Action:** Interact with the relevant service (Cloudflare SDK, database, vector store, etc.).
      - **Format Response:** Return an object with a `content` property, which is an array of `ContentBlock` objects (usually `type: 'text'` or `type: 'resource'`).
        - For simple success/failure or structured data, `JSON.stringify` the result in a text block.
        - For richer data like search results, use `EmbeddedResource` (`type: 'resource'`) as seen in `docs-autorag.tools.ts`.
        - Return clear error messages in the `text` property of a content block upon failure.

## Best Practices

- **Clear Descriptions are Paramount:** Invest time in writing excellent tool descriptions. This has the biggest impact on the LLM's ability to use tools effectively.
- **Granular Tools:** Prefer smaller, focused tools over monolithic ones. (e.g., separate `_create`, `_list`, `_get`, `_update`, `_delete` tools for a resource).
- **Robust Error Handling:** Anticipate potential failures and return informative error messages to the LLM.
- **Consistent Naming:** Follow naming conventions for tools and parameters.
- **Use Zod Validators:** Leverage Zod for input validation as described in the validator guide.
- **Leverage Agent Context:** Use `agent.props`, `agent.env`, and helper methods like `agent.getActiveAccountId()` appropriately.
- **Statelessness:** Aim for tools to be stateless where possible. Rely on parameters and agent context for necessary information.
- **Security:** Be mindful of the actions tools perform, especially destructive ones (`delete`, `update`). Ensure proper authentication and authorization context is used (e.g., checking the active account ID).
