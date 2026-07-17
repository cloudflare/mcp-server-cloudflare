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
const MAX_REMINDERS = 100

/**
 * Load all reminders
 */
export async function listReminders(storage: R2Storage): Promise<Reminder[]> {
	const file = await storage.read(REMINDERS_INDEX_PATH)
	if (!file) return []
	try {
		const parsed = JSON.parse(file.content) as unknown
		if (!Array.isArray(parsed) || parsed.length > MAX_REMINDERS || !parsed.every(isReminder)) {
			throw new Error('invalid shape')
		}
		return parsed
	} catch (error) {
		throw new Error(
			`Reminder index is corrupted: ${error instanceof Error ? error.message : String(error)}`
		)
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
	validateReminderExpression(reminder)
	const reminders = await listReminders(storage)

	// Remove existing reminder with same ID
	const filtered = reminders.filter((r) => r.id !== reminder.id)
	if (filtered.length >= MAX_REMINDERS) {
		throw new Error(`Cannot schedule more than ${MAX_REMINDERS} reminders`)
	}

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
	if (!matchesCronField(minute, now.getUTCMinutes(), 0, 59)) return false
	if (!matchesCronField(hour, now.getUTCHours(), 0, 23)) return false
	if (!matchesCronField(dayOfMonth, now.getUTCDate(), 1, 31)) return false
	if (!matchesCronField(month, now.getUTCMonth() + 1, 1, 12)) return false
	if (!matchesCronField(dayOfWeek, now.getUTCDay(), 0, 6)) return false

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
function matchesCronField(field: string, value: number, min: number, max: number): boolean {
	if (field === '*') return true

	if (field.startsWith('*/')) {
		const interval = Number(field.slice(2))
		return Number.isInteger(interval) && interval > 0 && value % interval === 0
	}

	if (field.includes(',')) {
		return field.split(',').some((item) => matchesCronField(item.trim(), value, min, max))
	}

	if (field.includes('-')) {
		const range = field.split('-')
		if (range.length !== 2) return false
		const [start, end] = range.map(Number)
		return (
			Number.isInteger(start) &&
			Number.isInteger(end) &&
			start >= min &&
			end <= max &&
			start <= end &&
			value >= start &&
			value <= end
		)
	}

	const expected = Number(field)
	return Number.isInteger(expected) && expected >= min && expected <= max && expected === value
}

function validateReminderExpression(reminder: Omit<Reminder, 'createdAt'>): void {
	if (reminder.type === 'once') {
		if (!Number.isFinite(Date.parse(reminder.expression))) {
			throw new Error('One-shot reminder expression must be a valid ISO datetime')
		}
		return
	}

	const parts = reminder.expression.trim().split(/\s+/)
	const ranges: Array<[number, number]> = [
		[0, 59],
		[0, 23],
		[1, 31],
		[1, 12],
		[0, 6],
	]
	if (
		parts.length !== 5 ||
		parts.some((field, index) => !cronFieldIsValid(field, ranges[index][0], ranges[index][1]))
	) {
		throw new Error('Cron reminder expression must contain five valid UTC cron fields')
	}
}

function cronFieldIsValid(field: string, min: number, max: number): boolean {
	if (field === '*') return true
	if (field.startsWith('*/')) {
		const interval = Number(field.slice(2))
		return Number.isInteger(interval) && interval > 0 && interval <= max - min + 1
	}
	if (field.includes(',')) {
		const items = field.split(',')
		return items.length > 1 && items.every((item) => cronFieldIsValid(item.trim(), min, max))
	}
	if (field.includes('-')) {
		const range = field.split('-')
		if (range.length !== 2) return false
		const [start, end] = range.map(Number)
		return (
			Number.isInteger(start) && Number.isInteger(end) && start >= min && end <= max && start <= end
		)
	}
	const value = Number(field)
	return Number.isInteger(value) && value >= min && value <= max
}

function isReminder(value: unknown): value is Reminder {
	if (!value || typeof value !== 'object') return false
	const candidate = value as Partial<Reminder>
	return (
		typeof candidate.id === 'string' &&
		(candidate.type === 'once' || candidate.type === 'cron') &&
		typeof candidate.expression === 'string' &&
		typeof candidate.description === 'string' &&
		typeof candidate.payload === 'string' &&
		typeof candidate.createdAt === 'string' &&
		(candidate.lastFired === undefined || typeof candidate.lastFired === 'string') &&
		(candidate.model === undefined || typeof candidate.model === 'string')
	)
}

/**
 * Get reminder by ID
 */
export async function getReminder(storage: R2Storage, id: string): Promise<Reminder | null> {
	const reminders = await listReminders(storage)
	return reminders.find((r) => r.id === id) || null
}
