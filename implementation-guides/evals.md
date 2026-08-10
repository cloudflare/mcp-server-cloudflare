# Evaluation Implementation Guide

This guide explains how to create evaluation tests (`.eval.ts` files) for testing AI model interactions with specific tools or systems, such as Cloudflare Worker bindings or container environments.

## What are Evals?

Evals are automated tests designed to verify if an AI model correctly understands instructions and utilizes its available "tools" (functions, API calls, environment interactions) to achieve a desired outcome. They assess the model's ability to follow instructions, select appropriate tools, and provide correct arguments to those tools.

## Core Concepts

Evals are typically built using a testing framework like `vitest` combined with specialized evaluation libraries like `vitest-evals`. The main structure revolves around `describeEval`:

```typescript
import { expect } from 'vitest'
import { describeEval } from 'vitest-evals'

import { checkFactuality } from '@repo/eval-tools/src/scorers'
import { eachModel } from '@repo/eval-tools/src/test-models'

import { initializeClient, runTask } from './utils' // Helper functions

eachModel('$modelName', ({ model }) => {
	// Optional: Run tests for multiple models
	describeEval('A descriptive name for the evaluation suite', {
		data: async () => [
			/* Test cases */
		],
		task: async (input) => {
			/* Test logic */
		},
		scorers: [
			/* Scoring functions */
		],
		threshold: 1, // Passing score threshold
		timeout: 60000, // Test timeout
	})
})
```

### Key Parts:

1.  **`describeEval(name, options)`**: Defines a suite of evaluation tests.

    - `name`: A string describing the purpose of the eval suite.
    - `options`: An object containing the configuration for the eval:
      - **`data`**: An async function returning an array of test case objects. Each object typically contains:
        - `input`: (string) The instruction given to the AI model.
        - `expected`: (string) A natural language description of the _expected_ sequence of actions or outcome. This is used by scorers.
      - **`task`**: An async function that executes the actual test logic for a given `input`. It orchestrates the interaction with the AI/system and performs assertions.
      - **`scorers`**: An array of scoring functions (e.g., `checkFactuality`) that evaluate the test outcome based on the `promptOutput` from the `task` and the `expected` string from the `data`.
      - **`threshold`**: (number, usually between 0 and 1) The minimum score required from the scorers for the test case to pass. A threshold of `1` means a perfect score is required.
      - **`timeout`**: (number) Maximum time in milliseconds allowed for a single test case.

2.  **`task(input)` Function**: The heart of the eval. It typically involves:

    - **Setup**: Initializing a client or test environment (`initializeClient`). This prepares the system for the test, configuring available tools or connections.
    - **Execution**: Running the actual interaction (`runTask`). This function sends the `input` instruction to the AI model via the client and captures the results, which usually include:
      - `promptOutput`: The textual response from the AI model.
      - `toolCalls`: A structured list of the tools the AI invoked, along with the arguments passed to each tool.
    - **Assertions (`expect`)**: Using the testing framework's assertion library (`vitest`'s `expect` in the examples) to verify that the correct tools were called with the correct arguments based on the `toolCalls` data. Sometimes, this involves direct interaction with the system state (e.g., reading a file created by a tool) to confirm the outcome.
    - **Return Value**: The `task` function usually returns the `promptOutput` to be evaluated by the `scorers`.

3.  **Scoring (`checkFactuality`, etc.)**: Automated functions that compare the actual outcome (represented by the `promptOutput` and implicitly by the assertions passed within the `task`) against the `expected` description.

4.  **Helper Utilities (`./utils`)**:
    - `initializeClient()`: Sets up the testing environment, connects to the system under test, and configures the available tools for the AI model.
    - `runTask(client, model, input)`: Sends the input prompt to the specified AI model using the configured client, executes the model's reasoning and tool use, and returns the results (`promptOutput`, `toolCalls`).
    - `eachModel()`: (Optional) A utility to run the same evaluation suite against multiple different AI models.

## Steps to Implement Evals

1.  **Identify Tools:** Define the specific actions or functions (the "tools") that the AI should be able to use within the system you're testing (e.g., `kv_write`, `d1_query`, `container_exec`).
2.  **Create Helper Functions:** Implement your `initializeClient` and `runTask` (or similarly named) functions.
    - `initializeClient`: Should set up the necessary context, potentially using test environments like `vitest-environment-miniflare` for workers. It needs to make the defined tools available to the AI model simulation.
    - `runTask`: Needs to simulate the AI processing: take an input prompt, interact with an LLM (or a mock) configured with the tools, capture which tools are called and with what arguments, and capture the final text output.
3.  **Create Eval File (`*.eval.ts`):** Create a new file (e.g., `kv-operations.eval.ts`).
4.  **Import Dependencies:** Import `describeEval`, scorers, helpers, `expect`, etc.
5.  **Structure with `describeEval`:** Define your evaluation suite.
6.  **Define Test Cases (`data`):** Write specific test scenarios:
    - Provide clear, unambiguous `input` prompts that target the tools you want to test.
    - Write concise `expected` descriptions detailing the primary tool calls or outcomes anticipated.
7.  **Implement the `task` Function:**
    - Call `initializeClient`.
    - Call `runTask` with the `input`.
    - Write `expect` assertions to rigorously check:
      - Were the correct tools called? (`toolName`)
      - Were they called in the expected order (if applicable)?
      - Were the arguments passed to the tools correct? (`args`)
      - (Optional) Interact with the system state if necessary to verify side effects.
    - Return the `promptOutput`.
8.  **Configure Scorers and Threshold:** Choose appropriate scorers (often `checkFactuality`) and set a `threshold`.
9.  **Run Tests:** Execute the evals using your test runner (e.g., `vitest run`).

## Example Structure (Simplified)

```typescript
// my-feature.eval.ts
import { expect } from 'vitest'
import { describeEval } from 'vitest-evals'

import { checkFactuality } from '@repo/eval-tools/src/scorers'

import { initializeClient, runTask } from './utils'

describeEval('Tests My Feature Tool Interactions', {
	data: async () => [
		{
			input: 'Use my_tool to process the data "example"',
			expected: 'The my_tool tool was called with data set to "example"',
		},
		// ... more test cases
	],
	task: async (input) => {
		const client = await initializeClient() // Sets up environment with my_tool
		const { promptOutput, toolCalls } = await runTask(client, 'your-model', input)

		// Check if my_tool was called
		const myToolCall = toolCalls.find((call) => call.toolName === 'my_tool')
		expect(myToolCall).toBeDefined()

		// Check arguments passed to my_tool
		expect(myToolCall?.args).toEqual(
			expect.objectContaining({
				data: 'example',
				// ... other expected args
			})
		)

		return promptOutput // Return AI output for scoring
	},
	scorers: [checkFactuality],
	threshold: 1,
})
```

## Best Practices

- **Clear Inputs:** Write inputs as clear, actionable instructions.
- **Specific Expected Outcomes:** Make `expected` descriptions precise enough for scorers but focus on the key actions.
- **Targeted Assertions:** Use `expect` to verify the most critical aspects of tool calls (tool name, key arguments). Don't over-assert on trivial details unless necessary.
- **Isolate Tests:** Ensure each test case in `data` tests a specific interaction or a small sequence of interactions.
- **Helper Functions:** Keep `initializeClient` and `runTask` generic enough to be reused across different eval files for the same system.
- **Use `expect.objectContaining` or `expect.stringContaining`:** Often, you only need to verify _parts_ of the arguments, not the entire structure, making tests less brittle.
- **Descriptive Names:** Use clear names for `describeEval` blocks and meaningful `input`/`expected` strings.
