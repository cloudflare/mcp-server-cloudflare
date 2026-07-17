/**
 * Reflection orchestrator.
 *
 * In the managed multi-tenant deployment reflection is **on-demand and
 * opt-out** — there is no global cron sweeping every user's memory nightly
 * (that would be surprising, and would spend the user's AI budget without
 * them asking). It runs only when the user calls the `run_reflection` tool,
 * and only if they haven't disabled it in their config.
 *
 * On completion, if the user has configured a generic webhook, a plain JSON
 * summary is POSTed to it. No vendor-specific formatting.
 */

import { loadConfig } from '../config'
import { sendWebhook } from '../webhook'
import { runAgenticReflection } from './agentic'
import { archiveReflection, writeStagedReflection } from './staging'

import type { UserContext } from '../user-context'
import type { ReflectionChange } from '../webhook'
import type { AgenticReflectionResult } from './agentic'
import type { StagedReflection } from './staging'

const LAST_REFLECTION_PATH = 'memory/meta/last-reflection.json'

export interface ReflectionResult {
	success: boolean
	date: string
	skipped?: boolean
	summary?: string
	error?: string
	autoApplied?: number
	proposed?: number
	quickFixes?: ReflectionChange[]
	edits?: ReflectionChange[]
	failedEdits?: string[]
}

/**
 * Run a reflection for one user. Respects the per-user opt-out and fires the
 * configured webhook (if any) on completion.
 */
export async function runReflection(
	userCtx: UserContext,
	ctx?: ExecutionContext
): Promise<ReflectionResult> {
	const date = new Date().toISOString().split('T')[0]
	const { storage } = userCtx

	const config = await loadConfig(storage)
	if (!config.reflectionsEnabled) {
		return {
			success: true,
			date,
			skipped: true,
			summary:
				'Reflection is disabled in your config. Enable it with set_config { reflectionsEnabled: true }.',
		}
	}

	try {
		const result = await runReflectionFlow(userCtx, date)

		console.log(
			JSON.stringify({
				event: 'reflection_complete',
				date,
				success: result.success,
				autoApplied: result.autoApplied ?? 0,
				proposed: result.proposed ?? 0,
				error: result.error,
			})
		)

		if (config.webhookUrl) {
			const send = sendWebhook(
				{ url: config.webhookUrl, headers: config.webhookHeaders },
				{
					event: 'reflection.completed',
					date,
					summary: result.summary ?? 'Reflection complete — no issues found.',
					quickFixes: result.quickFixes,
					edits: result.edits,
					failedEdits: result.failedEdits,
				}
			)
			// Don't block the tool response on webhook delivery when possible.
			if (ctx) ctx.waitUntil(send)
			else await send
		}

		return result
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e)
		console.error(JSON.stringify({ event: 'reflection_failed', date, error }))

		if (config.webhookUrl) {
			const send = sendWebhook(
				{ url: config.webhookUrl, headers: config.webhookHeaders },
				{ event: 'reflection.failed', date, summary: `Reflection failed: ${error}`, error }
			)
			if (ctx) ctx.waitUntil(send)
			else await send
		}

		return { success: false, date, error }
	}
}

async function runReflectionFlow(userCtx: UserContext, date: string): Promise<ReflectionResult> {
	const { storage, ai, index } = userCtx
	const config = await loadConfig(storage)

	const agenticResult: AgenticReflectionResult = await runAgenticReflection({
		ai,
		storage,
		index,
		model: config.reflectionModel,
		modelFast: config.reflectionModelFast,
	})

	const hasChanges =
		agenticResult.proposedEdits.length > 0 || agenticResult.autoAppliedFixes.length > 0

	// Auto-apply all proposed edits directly.
	const appliedEdits: ReflectionChange[] = []
	const failedEdits: string[] = []

	for (const edit of agenticResult.proposedEdits) {
		try {
			switch (edit.action) {
				case 'replace':
				case 'create':
					if (edit.content) await storage.write(edit.path, edit.content)
					break
				case 'append':
					if (edit.content) {
						const existing = await storage.read(edit.path)
						const newContent = existing ? `${existing.content}\n${edit.content}` : edit.content
						await storage.write(edit.path, newContent)
					}
					break
				case 'delete':
					await storage.delete(edit.path)
					break
			}
			appliedEdits.push({ path: edit.path, action: edit.action, reason: edit.reason })
		} catch (e) {
			failedEdits.push(`${edit.action}: ${edit.path}`)
			console.error(
				JSON.stringify({
					event: 'auto_apply_edit_failed',
					path: edit.path,
					action: edit.action,
					error: e instanceof Error ? e.message : String(e),
				})
			)
		}
	}

	// Write reflection record to archive (audit trail).
	const stagedReflection: StagedReflection = {
		date,
		summary: agenticResult.summary || 'No summary provided.',
		proposedEdits: agenticResult.proposedEdits,
		autoAppliedFixes: agenticResult.autoAppliedFixes,
		flaggedIssues: agenticResult.flaggedIssues,
		quickScanIterations: agenticResult.quickScanIterations,
		deepAnalysisIterations: agenticResult.deepAnalysisIterations,
	}
	const pendingPath = await writeStagedReflection(storage, stagedReflection)
	await archiveReflection(storage, pendingPath)

	await storage.write(LAST_REFLECTION_PATH, JSON.stringify({ timestamp: Date.now(), date }))

	const quickFixes: ReflectionChange[] = agenticResult.autoAppliedFixes.map((f) => ({
		path: f.path,
		action: f.fixType,
		reason: f.reason,
	}))

	let summary: string
	if (!hasChanges) {
		summary = 'Memory looks good — no issues found.'
	} else {
		const parts: string[] = []
		if (quickFixes.length > 0) parts.push(`${quickFixes.length} quick fixes`)
		if (appliedEdits.length > 0) parts.push(`${appliedEdits.length} edits`)
		if (failedEdits.length > 0) parts.push(`${failedEdits.length} failed`)
		summary = `Auto-applied ${parts.join(', ')}.`
		if (agenticResult.summary) summary += `\n\n${agenticResult.summary}`
	}

	return {
		success: agenticResult.success,
		date,
		summary,
		autoApplied: quickFixes.length + appliedEdits.length,
		proposed: 0,
		quickFixes,
		edits: appliedEdits,
		failedEdits: failedEdits.length > 0 ? failedEdits : undefined,
		error: agenticResult.error,
	}
}
