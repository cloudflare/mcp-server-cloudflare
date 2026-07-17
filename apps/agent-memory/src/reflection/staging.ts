/**
 * Staged Changes Writer
 *
 * Writes reflection results to pending/ directory for human review.
 * Includes proposed edits, auto-applied fixes summary, and analysis details.
 */

import type { R2Storage } from '../storage/r2'
import type { AutoAppliedFix, FlaggedIssue, ProposedEdit } from './tool-executor'

const PENDING_DIR = 'memory/reflections/pending'

/**
 * Full reflection data to be staged
 */
export interface StagedReflection {
	date: string
	summary: string
	proposedEdits: ProposedEdit[]
	autoAppliedFixes: AutoAppliedFix[]
	flaggedIssues: FlaggedIssue[]
	quickScanIterations: number
	deepAnalysisIterations: number
}

/**
 * Write a staged reflection for human review.
 *
 * Writes two files:
 *   1. `{date}.md` — human-readable markdown with tables and prose
 *   2. `{date}.json` — structured sidecar that `apply_reflection_changes`
 *      uses to apply edits. Keeps the machine-readable shape decoupled
 *      from the markdown layout so the reflection writeup can be edited
 *      by humans without breaking the apply step.
 *
 * @returns The path to the markdown file (the sidecar path is derived by
 *          swapping the extension).
 */
export async function writeStagedReflection(
	storage: R2Storage,
	reflection: StagedReflection
): Promise<string> {
	const markdownPath = `${PENDING_DIR}/${reflection.date}.md`
	const jsonPath = `${PENDING_DIR}/${reflection.date}.json`

	await storage.write(markdownPath, buildStagedContent(reflection))
	await storage.write(jsonPath, JSON.stringify(reflection, null, 2))

	return markdownPath
}

/**
 * Read the structured sidecar for a pending reflection.
 *
 * Returns null if the sidecar is missing (e.g. legacy reflections from
 * before the sidecar was added). Callers should fall back to markdown
 * parsing in that case.
 */
export async function readStagedReflectionData(
	storage: R2Storage,
	date: string
): Promise<StagedReflection | null> {
	const jsonPath = `${PENDING_DIR}/${date}.json`
	const file = await storage.read(jsonPath)
	if (!file) return null
	try {
		return JSON.parse(file.content) as StagedReflection
	} catch {
		return null
	}
}

/**
 * Build the markdown content for a staged reflection
 */
function buildStagedContent(reflection: StagedReflection): string {
	const {
		date,
		summary,
		proposedEdits,
		autoAppliedFixes,
		flaggedIssues,
		quickScanIterations,
		deepAnalysisIterations,
	} = reflection

	const sections: string[] = []

	// Header
	sections.push(`# Reflection - ${date}

## Summary

${summary}

## Statistics

| Metric | Value |
|--------|-------|
| Quick Scan Iterations | ${quickScanIterations} |
| Deep Analysis Iterations | ${deepAnalysisIterations} |
| Auto-Applied Fixes | ${autoAppliedFixes.length} |
| Proposed Changes | ${proposedEdits.length} |
| Issues Flagged | ${flaggedIssues.length} |
`)

	// Auto-applied fixes section
	if (autoAppliedFixes.length > 0) {
		sections.push(`## Auto-Applied Fixes (Already Done)

These low-risk fixes were applied automatically:

${autoAppliedFixes
	.map(
		(fix, i) => `### ${i + 1}. ${fix.fixType.toUpperCase()} - ${fix.path}

**Reason:** ${fix.reason}
${fix.oldText ? `\n**Changed:** \`${escapeForMarkdown(fix.oldText.slice(0, 100))}\` → \`${escapeForMarkdown(fix.newText?.slice(0, 100) ?? '')}\`` : ''}
`
	)
	.join('\n')}
`)
	} else {
		sections.push(`## Auto-Applied Fixes

_No auto-fixes were applied._
`)
	}

	// Proposed edits section
	if (proposedEdits.length > 0) {
		sections.push(`## Proposed Changes (Require Review)

Review each proposed change below. To apply:

1. **replace**: Copy the content to replace the target file
2. **append**: Add the content to the end of the target file
3. **create**: Create a new file with the content
4. **delete**: Remove the target file

${proposedEdits
	.map(
		(edit, i) => `### ${i + 1}. ${edit.action.toUpperCase()}: ${edit.path}

**Reason:** ${edit.reason}

${
	edit.content
		? `**Content:**
\`\`\`
${edit.content}
\`\`\`
`
		: ''
}`
	)
	.join('\n')}
`)
	} else {
		sections.push(`## Proposed Changes

_No changes proposed for review._
`)
	}

	// Flagged issues that weren't fully resolved
	if (flaggedIssues.length > 0) {
		const unresolvedFlags = flaggedIssues.filter(
			(flag) => !proposedEdits.some((edit) => edit.path === flag.path)
		)

		if (unresolvedFlags.length > 0) {
			sections.push(`## Unresolved Issues

These issues were flagged but no specific fix was proposed:

${unresolvedFlags.map((flag) => `- **${flag.path}**: ${flag.issue}`).join('\n')}

Consider reviewing these manually.
`)
		}
	}

	// Instructions
	sections.push(`## After Review

Once you've reviewed and applied any desired changes:

1. Delete this file, OR
2. Move to \`memory/reflections/archive/${date}.md\`

This ensures the next reflection starts fresh.
`)

	return sections.join('\n')
}

/**
 * Escape special characters for markdown inline code
 */
function escapeForMarkdown(text: string): string {
	return text.replace(/`/g, '\\`').replace(/\n/g, '\\n')
}

/**
 * List all pending reflections
 */
export async function listPendingReflections(
	storage: R2Storage
): Promise<Array<{ path: string; date: string }>> {
	const files = await storage.list(PENDING_DIR, false)

	return files
		.filter((f) => f.path.endsWith('.md'))
		.map((f) => {
			// Extract date from filename: memory/reflections/pending/2026-02-04.md
			const match = f.path.match(/(\d{4}-\d{2}-\d{2})\.md$/)
			return {
				path: f.path,
				date: match ? match[1] : 'unknown',
			}
		})
		.sort((a, b) => b.date.localeCompare(a.date)) // Most recent first
}

/**
 * Archive a pending reflection (move from pending to archive).
 *
 * Moves both the markdown and the structured JSON sidecar if present. The
 * JSON sidecar was added in 2026 — older pending reflections may only have
 * the markdown, which is fine.
 */
export async function archiveReflection(
	storage: R2Storage,
	pendingPath: string
): Promise<string | null> {
	const file = await storage.read(pendingPath)
	if (!file) {
		return null
	}

	const match = pendingPath.match(/(\d{4}-\d{2}-\d{2})\.md$/)
	if (!match) {
		return null
	}

	const date = match[1]
	const archivePath = `memory/reflections/archive/${date}.md`
	await storage.write(archivePath, file.content)
	await storage.delete(pendingPath)

	// Move the JSON sidecar too, if it exists. Don't fail archiving if the
	// sidecar is missing — it's optional for backwards compat.
	const jsonSource = `${PENDING_DIR}/${date}.json`
	const jsonSidecar = await storage.read(jsonSource)
	if (jsonSidecar) {
		await storage.write(`memory/reflections/archive/${date}.json`, jsonSidecar.content)
		await storage.delete(jsonSource)
	}

	return archivePath
}
