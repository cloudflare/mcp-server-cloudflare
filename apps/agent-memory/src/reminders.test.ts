import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	checkReminders,
	getReminder,
	listReminders,
	removeReminder,
	scheduleReminder,
} from './reminders'
import { createMockStorage } from './test/mock-storage'

import type { Reminder } from './reminders'

describe('reminders', () => {
	let storage: ReturnType<typeof createMockStorage>

	beforeEach(() => {
		storage = createMockStorage()
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	describe('listReminders', () => {
		it('should return empty array when no reminders exist', async () => {
			const reminders = await listReminders(storage)
			expect(reminders).toHaveLength(0)
		})

		it('should return existing reminders', async () => {
			const existing: Reminder[] = [
				{
					id: 'r1',
					type: 'once',
					expression: '2026-02-01T10:00:00Z',
					description: 'Test reminder',
					payload: 'Do something',
					createdAt: '2026-01-31T10:00:00Z',
				},
			]
			await storage.write('reminders/index.json', JSON.stringify(existing))

			const reminders = await listReminders(storage)

			expect(reminders).toHaveLength(1)
			expect(reminders[0].id).toBe('r1')
		})

		it('should refuse to overwrite corrupted reminder data', async () => {
			await storage.write('reminders/index.json', 'not valid json')

			await expect(listReminders(storage)).rejects.toThrow(/corrupted/)
		})
	})

	describe('scheduleReminder', () => {
		it('should create a new one-shot reminder', async () => {
			const reminder = await scheduleReminder(storage, {
				id: 'reminder-1',
				type: 'once',
				expression: '2026-02-01T10:00:00Z',
				description: 'Meeting reminder',
				payload: 'You have a meeting in 15 minutes',
			})

			expect(reminder.id).toBe('reminder-1')
			expect(reminder.type).toBe('once')
			expect(reminder.createdAt).toBeDefined()

			const all = await listReminders(storage)
			expect(all).toHaveLength(1)
		})

		it('should create a cron reminder', async () => {
			const reminder = await scheduleReminder(storage, {
				id: 'daily-standup',
				type: 'cron',
				expression: '0 9 * * *',
				description: 'Daily standup',
				payload: 'Time for daily standup!',
			})

			expect(reminder.type).toBe('cron')
			expect(reminder.expression).toBe('0 9 * * *')
		})

		it('should update existing reminder with same ID', async () => {
			await scheduleReminder(storage, {
				id: 'r1',
				type: 'once',
				expression: '2026-02-01T10:00:00Z',
				description: 'Original',
				payload: 'Original payload',
			})

			await scheduleReminder(storage, {
				id: 'r1',
				type: 'once',
				expression: '2026-02-01T11:00:00Z',
				description: 'Updated',
				payload: 'Updated payload',
			})

			const all = await listReminders(storage)
			expect(all).toHaveLength(1)
			expect(all[0].description).toBe('Updated')
			expect(all[0].expression).toBe('2026-02-01T11:00:00Z')
		})

		it('should store model hint when provided', async () => {
			const reminder = await scheduleReminder(storage, {
				id: 'r1',
				type: 'once',
				expression: '2026-02-01T10:00:00Z',
				description: 'Test',
				payload: 'Test payload',
				model: 'claude-3-opus',
			})

			expect(reminder.model).toBe('claude-3-opus')
		})
	})

	describe('removeReminder', () => {
		it('should remove existing reminder', async () => {
			await scheduleReminder(storage, {
				id: 'r1',
				type: 'once',
				expression: '2026-02-01T10:00:00Z',
				description: 'Test',
				payload: 'Test',
			})

			const result = await removeReminder(storage, 'r1')

			expect(result).toBe(true)
			const all = await listReminders(storage)
			expect(all).toHaveLength(0)
		})

		it('should return false for non-existent reminder', async () => {
			const result = await removeReminder(storage, 'non-existent')
			expect(result).toBe(false)
		})

		it('should only remove specified reminder', async () => {
			await scheduleReminder(storage, {
				id: 'r1',
				type: 'once',
				expression: '2026-02-01T10:00:00Z',
				description: 'First',
				payload: 'First',
			})
			await scheduleReminder(storage, {
				id: 'r2',
				type: 'once',
				expression: '2026-02-02T10:00:00Z',
				description: 'Second',
				payload: 'Second',
			})

			await removeReminder(storage, 'r1')

			const all = await listReminders(storage)
			expect(all).toHaveLength(1)
			expect(all[0].id).toBe('r2')
		})
	})

	describe('getReminder', () => {
		it('should return reminder by ID', async () => {
			await scheduleReminder(storage, {
				id: 'r1',
				type: 'once',
				expression: '2026-02-01T10:00:00Z',
				description: 'Test',
				payload: 'Test payload',
			})

			const reminder = await getReminder(storage, 'r1')

			expect(reminder).not.toBeNull()
			expect(reminder!.description).toBe('Test')
		})

		it('should return null for non-existent reminder', async () => {
			const reminder = await getReminder(storage, 'non-existent')
			expect(reminder).toBeNull()
		})
	})

	describe('checkReminders', () => {
		describe('one-shot reminders', () => {
			it('should fire when time has passed', async () => {
				vi.setSystemTime(new Date('2026-01-31T09:00:00Z'))

				await scheduleReminder(storage, {
					id: 'r1',
					type: 'once',
					expression: '2026-01-31T10:00:00Z',
					description: 'Past reminder',
					payload: 'Should fire',
				})

				// Advance time past the reminder
				vi.setSystemTime(new Date('2026-01-31T10:30:00Z'))

				const fired = await checkReminders(storage)

				expect(fired).toHaveLength(1)
				expect(fired[0].reminder.id).toBe('r1')
				expect(fired[0].reminder.payload).toBe('Should fire')
			})

			it('should not fire when time has not passed', async () => {
				vi.setSystemTime(new Date('2026-01-31T09:00:00Z'))

				await scheduleReminder(storage, {
					id: 'r1',
					type: 'once',
					expression: '2026-01-31T10:00:00Z',
					description: 'Future reminder',
					payload: 'Should not fire yet',
				})

				const fired = await checkReminders(storage)

				expect(fired).toHaveLength(0)
			})

			it('should remove one-shot reminder after firing', async () => {
				vi.setSystemTime(new Date('2026-01-31T09:00:00Z'))

				await scheduleReminder(storage, {
					id: 'r1',
					type: 'once',
					expression: '2026-01-31T10:00:00Z',
					description: 'Once only',
					payload: 'Fire once',
				})

				vi.setSystemTime(new Date('2026-01-31T10:30:00Z'))
				await checkReminders(storage)

				const remaining = await listReminders(storage)
				expect(remaining).toHaveLength(0)
			})
		})

		describe('cron reminders', () => {
			it('should fire at matching time', async () => {
				// Set time to 8:59 UTC
				vi.setSystemTime(new Date('2026-01-31T08:59:00Z'))

				await scheduleReminder(storage, {
					id: 'daily',
					type: 'cron',
					expression: '0 9 * * *', // 9:00 UTC daily
					description: 'Daily reminder',
					payload: 'Daily check-in',
				})

				// Advance to 9:00 UTC
				vi.setSystemTime(new Date('2026-01-31T09:00:00Z'))

				const fired = await checkReminders(storage)

				expect(fired).toHaveLength(1)
				expect(fired[0].reminder.id).toBe('daily')
			})

			it('should not fire at non-matching time', async () => {
				vi.setSystemTime(new Date('2026-01-31T10:00:00Z'))

				await scheduleReminder(storage, {
					id: 'daily',
					type: 'cron',
					expression: '0 9 * * *', // 9:00 UTC daily
					description: 'Daily reminder',
					payload: 'Daily check-in',
				})

				const fired = await checkReminders(storage)

				expect(fired).toHaveLength(0)
			})

			it('should not fire twice in same minute', async () => {
				vi.setSystemTime(new Date('2026-01-31T09:00:00Z'))

				await scheduleReminder(storage, {
					id: 'daily',
					type: 'cron',
					expression: '0 9 * * *',
					description: 'Daily',
					payload: 'Test',
				})

				// First check
				const first = await checkReminders(storage)
				expect(first).toHaveLength(1)

				// Second check in same minute - should not fire again
				vi.setSystemTime(new Date('2026-01-31T09:00:30Z'))
				const second = await checkReminders(storage)
				expect(second).toHaveLength(0)
			})

			it('should fire again in next matching time', async () => {
				vi.setSystemTime(new Date('2026-01-31T09:00:00Z'))

				await scheduleReminder(storage, {
					id: 'daily',
					type: 'cron',
					expression: '0 9 * * *',
					description: 'Daily',
					payload: 'Test',
				})

				// First day
				const first = await checkReminders(storage)
				expect(first).toHaveLength(1)

				// Next day at 9:00
				vi.setSystemTime(new Date('2026-02-01T09:00:00Z'))
				const second = await checkReminders(storage)
				expect(second).toHaveLength(1)
			})

			it('should keep cron reminder after firing', async () => {
				vi.setSystemTime(new Date('2026-01-31T09:00:00Z'))

				await scheduleReminder(storage, {
					id: 'daily',
					type: 'cron',
					expression: '0 9 * * *',
					description: 'Daily',
					payload: 'Test',
				})

				await checkReminders(storage)

				const remaining = await listReminders(storage)
				expect(remaining).toHaveLength(1)
				expect(remaining[0].lastFired).toBeDefined()
			})
		})

		describe('cron expression parsing', () => {
			it('should match wildcard (*)', async () => {
				vi.setSystemTime(new Date('2026-01-31T15:30:00Z'))

				await scheduleReminder(storage, {
					id: 'every-minute',
					type: 'cron',
					expression: '30 * * * *', // Every hour at :30
					description: 'Every hour',
					payload: 'Test',
				})

				const fired = await checkReminders(storage)
				expect(fired).toHaveLength(1)
			})

			it('should match step values (*/N)', async () => {
				vi.setSystemTime(new Date('2026-01-31T12:00:00Z'))

				await scheduleReminder(storage, {
					id: 'every-2-hours',
					type: 'cron',
					expression: '0 */2 * * *', // Every 2 hours
					description: 'Bi-hourly',
					payload: 'Test',
				})

				const fired = await checkReminders(storage)
				expect(fired).toHaveLength(1)
			})

			it('should match comma-separated values', async () => {
				vi.setSystemTime(new Date('2026-01-31T09:00:00Z'))

				await scheduleReminder(storage, {
					id: 'specific-hours',
					type: 'cron',
					expression: '0 9,12,15 * * *', // 9am, 12pm, 3pm
					description: 'Three times daily',
					payload: 'Test',
				})

				const fired = await checkReminders(storage)
				expect(fired).toHaveLength(1)
			})

			it('should match ranges (N-M)', async () => {
				vi.setSystemTime(new Date('2026-01-31T10:00:00Z'))

				await scheduleReminder(storage, {
					id: 'work-hours',
					type: 'cron',
					expression: '0 9-17 * * *', // 9am to 5pm
					description: 'Work hours',
					payload: 'Test',
				})

				const fired = await checkReminders(storage)
				expect(fired).toHaveLength(1)
			})

			it('should match day of week', async () => {
				// 2026-01-31 is a Saturday (day 6)
				vi.setSystemTime(new Date('2026-01-31T09:00:00Z'))

				await scheduleReminder(storage, {
					id: 'saturday',
					type: 'cron',
					expression: '0 9 * * 6', // Saturdays at 9am
					description: 'Weekend reminder',
					payload: 'Test',
				})

				const fired = await checkReminders(storage)
				expect(fired).toHaveLength(1)
			})

			it('should not match wrong day of week', async () => {
				// 2026-01-31 is a Saturday (day 6)
				vi.setSystemTime(new Date('2026-01-31T09:00:00Z'))

				await scheduleReminder(storage, {
					id: 'monday',
					type: 'cron',
					expression: '0 9 * * 1', // Mondays at 9am
					description: 'Monday reminder',
					payload: 'Test',
				})

				const fired = await checkReminders(storage)
				expect(fired).toHaveLength(0)
			})

			it('should reject invalid cron expressions', async () => {
				await expect(
					scheduleReminder(storage, {
						id: 'invalid',
						type: 'cron',
						expression: 'invalid expression',
						description: 'Invalid',
						payload: 'Test',
					})
				).rejects.toThrow(/five valid UTC cron fields/)
			})
		})

		describe('multiple reminders', () => {
			it('should fire multiple reminders at once', async () => {
				vi.setSystemTime(new Date('2026-01-31T09:00:00Z'))

				await scheduleReminder(storage, {
					id: 'r1',
					type: 'once',
					expression: '2026-01-31T08:00:00Z', // Already passed
					description: 'First',
					payload: 'First payload',
				})

				await scheduleReminder(storage, {
					id: 'r2',
					type: 'cron',
					expression: '0 9 * * *', // Matches current time
					description: 'Second',
					payload: 'Second payload',
				})

				await scheduleReminder(storage, {
					id: 'r3',
					type: 'once',
					expression: '2026-01-31T10:00:00Z', // Future
					description: 'Third',
					payload: 'Third payload',
				})

				const fired = await checkReminders(storage)

				expect(fired).toHaveLength(2)
				expect(fired.map((f) => f.reminder.id).sort()).toEqual(['r1', 'r2'])
			})
		})
	})
})
