/**
 * Reminder System
 *
 * Stores scheduled reminders in R2. Clients poll check_reminders on startup
 * to see if any reminders have fired.
 *
 * Supports:
 * - One-shot reminders (fire once at a specific time)
 * - Recurring reminders (cron-style expressions)
 */

import type { R2Storage } from './storage/r2'

export interface Reminder {
	id: string
	type: 'once' | 'cron'
	expression: string // ISO datetime for "once", cron expression for "cron"
	description: string
	payload: string // Message to return when reminder fires
	model?: string // Optional model hint for client
	createdAt: string
	lastFired?: string // Track when cron reminders last fired
}

export interface FiredReminder {
	reminder: Reminder
	firedAt: string
}

const REMINDERS_INDEX_PATH = 'reminders/index.json'

/**
 * Load all reminders
 */
export async function listReminders(storage: R2Storage): Promise<Reminder[]> {
	const file = await storage.read(REMINDERS_INDEX_PATH)
	if (!file) return []
	try {
		return JSON.parse(file.content)
	} catch {
		return []
	}
}

/**
 * Save all reminders
 */
async function saveReminders(storage: R2Storage, reminders: Reminder[]): Promise<void> {
	await storage.write(REMINDERS_INDEX_PATH, JSON.stringify(reminders, null, 2))
}

/**
 * Create or update a reminder
 */
export async function scheduleReminder(
	storage: R2Storage,
	reminder: Omit<Reminder, 'createdAt'>
): Promise<Reminder> {
	const reminders = await listReminders(storage)

	// Remove existing reminder with same ID
	const filtered = reminders.filter((r) => r.id !== reminder.id)

	const newReminder: Reminder = {
		...reminder,
		createdAt: new Date().toISOString(),
	}

	filtered.push(newReminder)
	await saveReminders(storage, filtered)

	return newReminder
}

/**
 * Remove a reminder
 */
export async function removeReminder(storage: R2Storage, id: string): Promise<boolean> {
	const reminders = await listReminders(storage)
	const filtered = reminders.filter((r) => r.id !== id)

	if (filtered.length === reminders.length) {
		return false // Not found
	}

	await saveReminders(storage, filtered)
	return true
}

/**
 * Check for fired reminders
 * Returns reminders that should fire now, and updates their lastFired timestamp
 */
export async function checkReminders(storage: R2Storage): Promise<FiredReminder[]> {
	const reminders = await listReminders(storage)
	const now = new Date()
	const nowIso = now.toISOString()
	const fired: FiredReminder[] = []
	let changed = false

	const updated = reminders.filter((r) => {
		if (r.type === 'once') {
			// One-shot: fire if time has passed
			const fireTime = new Date(r.expression)
			if (fireTime <= now) {
				fired.push({ reminder: r, firedAt: nowIso })
				changed = true
				return false // Remove one-shot after firing
			}
		} else if (r.type === 'cron') {
			// Cron: check if should fire based on expression
			const shouldFire = shouldCronFire(r.expression, r.lastFired, now)
			if (shouldFire) {
				fired.push({ reminder: r, firedAt: nowIso })
				r.lastFired = nowIso
				changed = true
			}
		}
		return true // Keep the reminder
	})

	if (changed) {
		await saveReminders(storage, updated)
	}

	return fired
}

/**
 * Simple cron expression checker
 * Supports: minute hour day-of-month month day-of-week
 * Examples: "0 9 * * *" (9am daily), "0 9 * * 1" (9am Mondays)
 */
function shouldCronFire(expression: string, lastFired: string | undefined, now: Date): boolean {
	const parts = expression.trim().split(/\s+/)
	if (parts.length !== 5) return false

	const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

	// Check if current time matches cron expression
	if (!matchesCronField(minute, now.getUTCMinutes())) return false
	if (!matchesCronField(hour, now.getUTCHours())) return false
	if (!matchesCronField(dayOfMonth, now.getUTCDate())) return false
	if (!matchesCronField(month, now.getUTCMonth() + 1)) return false
	if (!matchesCronField(dayOfWeek, now.getUTCDay())) return false

	// Check we haven't fired in the current minute
	if (lastFired) {
		const lastFiredDate = new Date(lastFired)
		const sameMinute =
			lastFiredDate.getUTCFullYear() === now.getUTCFullYear() &&
			lastFiredDate.getUTCMonth() === now.getUTCMonth() &&
			lastFiredDate.getUTCDate() === now.getUTCDate() &&
			lastFiredDate.getUTCHours() === now.getUTCHours() &&
			lastFiredDate.getUTCMinutes() === now.getUTCMinutes()
		if (sameMinute) return false
	}

	return true
}

/**
 * Check if a value matches a cron field
 */
function matchesCronField(field: string, value: number): boolean {
	if (field === '*') return true

	// Handle */N (every N)
	if (field.startsWith('*/')) {
		const interval = Number.parseInt(field.slice(2), 10)
		return value % interval === 0
	}

	// Handle comma-separated values
	if (field.includes(',')) {
		return field.split(',').some((f) => matchesCronField(f.trim(), value))
	}

	// Handle ranges (e.g., 1-5)
	if (field.includes('-')) {
		const [start, end] = field.split('-').map((n) => Number.parseInt(n, 10))
		return value >= start && value <= end
	}

	// Simple numeric match
	return Number.parseInt(field, 10) === value
}

/**
 * Get reminder by ID
 */
export async function getReminder(storage: R2Storage, id: string): Promise<Reminder | null> {
	const reminders = await listReminders(storage)
	return reminders.find((r) => r.id === id) || null
}
