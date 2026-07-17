/**
 * Reflection Tools
 *
 * Defines the tools available to the agentic reflection system.
 * These enable the LLM to explore memory, identify issues, and propose fixes.
 */

import type { LLMTool } from '../llm/types'

/**
 * Tools available during reflection
 *
 * The reflection agent can:
 * 1. Search memory semantically to find relevant files
 * 2. Read full file contents
 * 3. List directory contents
 * 4. Propose edits (staged for human review)
 * 5. Auto-apply low-risk fixes (typos, formatting)
 * 6. Finish reflection with a summary
 */
export const REFLECTION_TOOLS: LLMTool[] = [
	{
		name: 'searchMemory',
		description:
			'Search memory semantically to find relevant files. Use when you need to find information about a topic or discover related content.',
		parameters: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: "Natural language query describing what you're looking for",
				},
				limit: {
					type: 'number',
					description: 'Max results to return (default 5, max 20)',
				},
			},
			required: ['query'],
		},
	},
	{
		name: 'readFile',
		description:
			'Read the full contents of a memory file. Use after searchMemory to get details, or when you know the exact path.',
		parameters: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: "File path relative to memory root, e.g., 'memory/learnings.md'",
				},
			},
			required: ['path'],
		},
	},
	{
		name: 'listFiles',
		description: 'List files in a directory. Use to explore memory structure and discover files.',
		parameters: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: "Directory path, e.g., 'memory/patterns' or 'memory/workload'",
				},
				recursive: {
					type: 'boolean',
					description: 'Whether to list recursively (default false)',
				},
			},
			required: ['path'],
		},
	},
	{
		name: 'getBacklinks',
		description:
			'List files that link to the given target via Obsidian-style [[wikilinks]]. Use before proposing to delete or merge a file to understand what references it. Also useful for identifying hubs (many backlinks) and orphans (none).',
		parameters: {
			type: 'object',
			properties: {
				target: {
					type: 'string',
					description:
						"Wikilink target as written inside [[...]]. For a file at memory/foo.md this is typically 'memory/foo' or 'foo' depending on how it's linked.",
				},
			},
			required: ['target'],
		},
	},
	{
		name: 'proposeEdit',
		description:
			'Propose an edit to a memory file. All proposed changes are staged for human review before being applied.',
		parameters: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'File path to edit',
				},
				action: {
					type: 'string',
					description: 'Type of edit to perform',
					enum: ['replace', 'append', 'delete', 'create'],
				},
				content: {
					type: 'string',
					description:
						'New content for the file (required for replace/append/create, ignored for delete)',
				},
				reason: {
					type: 'string',
					description:
						'Explain why this change is needed - be specific about the issue being fixed',
				},
			},
			required: ['path', 'action', 'reason'],
		},
	},
	{
		name: 'autoApply',
		description:
			'Apply a low-risk fix immediately without human review. Only use for: typo fixes in prose (not code), trailing newlines, extra whitespace, duplicate removal. The change will be applied immediately.',
		parameters: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'File path to fix',
				},
				fixType: {
					type: 'string',
					description: 'Type of fix being applied',
					enum: ['typo', 'whitespace', 'newline', 'duplicate', 'formatting'],
				},
				oldText: {
					type: 'string',
					description: 'The exact text to replace (for typo/whitespace fixes)',
				},
				newText: {
					type: 'string',
					description: 'The corrected text',
				},
				reason: {
					type: 'string',
					description: 'Brief explanation of the fix',
				},
			},
			required: ['path', 'fixType', 'reason'],
		},
	},
	{
		name: 'finishReflection',
		description:
			'Complete the reflection with a summary. Call this when you have finished analyzing memory and proposing changes.',
		parameters: {
			type: 'object',
			properties: {
				summary: {
					type: 'string',
					description:
						'2-3 sentence summary of findings and actions taken. Include counts of issues found and changes proposed.',
				},
				proposedChanges: {
					type: 'number',
					description: 'Total number of changes proposed for human review',
				},
				autoApplied: {
					type: 'number',
					description: 'Total number of low-risk fixes auto-applied',
				},
			},
			required: ['summary', 'proposedChanges', 'autoApplied'],
		},
	},
]

/**
 * Quick scan tools for GLM Flash (Phase A)
 *
 * Limited subset for quick, safe operations that can be auto-applied
 */
export const QUICK_SCAN_TOOLS: LLMTool[] = [
	{
		name: 'listFiles',
		description: 'List files in a directory to scan for issues.',
		parameters: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'Directory path to list',
				},
				recursive: {
					type: 'boolean',
					description: 'Whether to list recursively',
				},
			},
			required: ['path'],
		},
	},
	{
		name: 'readFile',
		description: 'Read a file to check for formatting issues.',
		parameters: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'File path to read',
				},
			},
			required: ['path'],
		},
	},
	{
		name: 'autoApply',
		description: 'Apply a safe fix immediately. Only for: typos, whitespace, newlines, duplicates.',
		parameters: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'File path to fix',
				},
				fixType: {
					type: 'string',
					description: 'Type of fix',
					enum: ['typo', 'whitespace', 'newline', 'duplicate', 'formatting'],
				},
				oldText: {
					type: 'string',
					description: 'Text to replace',
				},
				newText: {
					type: 'string',
					description: 'Replacement text',
				},
				reason: {
					type: 'string',
					description: 'Explanation',
				},
			},
			required: ['path', 'fixType', 'reason'],
		},
	},
	{
		name: 'flagForDeepAnalysis',
		description: 'Flag a complex issue for the deep analysis phase.',
		parameters: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'File path with the issue',
				},
				issue: {
					type: 'string',
					description: 'Description of the issue that needs deeper analysis',
				},
			},
			required: ['path', 'issue'],
		},
	},
	{
		name: 'finishQuickScan',
		description: 'Complete the quick scan phase.',
		parameters: {
			type: 'object',
			properties: {
				autoApplied: {
					type: 'number',
					description: 'Number of fixes auto-applied',
				},
				flaggedForDeepAnalysis: {
					type: 'number',
					description: 'Number of issues flagged for deep analysis',
				},
			},
			required: ['autoApplied', 'flaggedForDeepAnalysis'],
		},
	},
]
