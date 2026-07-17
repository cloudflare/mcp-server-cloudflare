/**
 * Reflection orchestrator.
 *
 * In the managed multi-tenant deployment reflection is **on-demand and
 * opt-out** — there is no global cron sweeping every account's memory nightly
 * (that would be surprising, and would spend the account's AI budget without
 * them asking). It runs only when the user calls the `run_reflection` tool,
 * and only if they haven't disabled it in their config.
 *
 * On completion, if the user has configured a generic webhook, a plain JSON
 * summary is POSTed to it. No vendor-specific formatting.
 */

import { loadConfig } from '../config'
import { sendWebhook } from '../webhook'
import { runAgenticReflection } from './agentic'
import { archiveReflection, listPendingReflections, writeStagedReflection } from './staging'

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
 * Run a reflection for one selected account. Respects its stored opt-out and
 * fires the configured webhook (if any) on completion.
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

	// Do not spend more of the account's Workers AI allowance while an earlier
	// reflection still needs a human decision.
	const pending = await listPendingReflections(storage)
	if (pending.length > 0) {
		return {
			success: true,
			date,
			skipped: true,
			summary: `A pending reflection is awaiting review (${pending[0].date}). Apply or archive it before running another reflection.`,
		}
	}

	const lockToken = crypto.randomUUID()
	const { acquired } = await userCtx.index.acquireReflectionLock(lockToken, 15 * 60 * 1_000)
	if (!acquired) {
		return {
			success: true,
			date,
			skipped: true,
			summary: 'Another reflection is already running for this account.',
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
					event: result.success ? 'reflection.completed' : 'reflection.failed',
					date,
					summary: result.summary ?? 'Reflection complete — no issues found.',
					quickFixes: result.quickFixes,
					edits: result.edits,
					failedEdits: result.failedEdits,
					error: result.error,
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
	} finally {
		try {
			await userCtx.index.releaseReflectionLock(lockToken)
		} catch (error) {
			console.error(
				JSON.stringify({
					event: 'reflection_lock_release_failed',
					date,
					error: error instanceof Error ? error.message : String(error),
				})
			)
		}
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

	const quickFixes: ReflectionChange[] = agenticResult.autoAppliedFixes.map((fix) => ({
		path: fix.path,
		action: fix.fixType,
		reason: fix.reason,
	}))
	const proposedEdits: ReflectionChange[] = agenticResult.proposedEdits.map((edit) => ({
		path: edit.path,
		action: edit.action,
		reason: edit.reason,
	}))
	const needsReview =
		agenticResult.success && (proposedEdits.length > 0 || agenticResult.flaggedIssues.length > 0)

	// Always retain an audit record. Substantive edits and unresolved findings
	// stay pending for human review; quick-fix-only/no-op records are archived.
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
	if (!needsReview) {
		await archiveReflection(storage, pendingPath)
	}

	await storage.write(LAST_REFLECTION_PATH, JSON.stringify({ timestamp: Date.now(), date }))

	if (!agenticResult.success) {
		return {
			success: false,
			date,
			summary: `Reflection failed; substantive changes were archived for audit but cannot be applied.${agenticResult.error ? ` ${agenticResult.error}` : ''}`,
			autoApplied: quickFixes.length,
			proposed: 0,
			quickFixes,
			error: agenticResult.error,
		}
	}

	const parts: string[] = []
	if (quickFixes.length > 0) parts.push(`auto-applied ${quickFixes.length} quick fixes`)
	if (proposedEdits.length > 0) parts.push(`staged ${proposedEdits.length} edits for review`)
	if (agenticResult.flaggedIssues.length > 0) {
		parts.push(`flagged ${agenticResult.flaggedIssues.length} issues for review`)
	}
	let summary = parts.length > 0 ? `${parts.join('; ')}.` : 'Memory looks good — no issues found.'
	if (agenticResult.summary && parts.length > 0) summary += `\n\n${agenticResult.summary}`

	return {
		success: true,
		date,
		summary,
		autoApplied: quickFixes.length,
		proposed: proposedEdits.length,
		quickFixes,
		edits: proposedEdits,
	}
}
