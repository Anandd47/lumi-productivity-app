import test from 'node:test'
import assert from 'node:assert/strict'
import { toISODate } from '../src/domain/date.ts'
import { buildNativeReminderPlan, goalReminderId, isManagedReminderId, SLEEP_REMINDER_ID, STUDY_REMINDER_ID } from '../src/features/notifications/reminderSchedule.ts'

const preferences = {
  enabled: true,
  studyReminderEnabled: true,
  studyReminderTime: '09:15',
  goalReminderEnabled: true,
  goalReminderTime: '18:30',
  sleepReminderEnabled: true,
  sleepReminderTime: '22:00',
}

test('native daily reminders use stable IDs and selected local wall-clock times', () => {
  const now = new Date(2026, 9, 25, 8, 0)
  const plan = buildNativeReminderPlan(preferences, 6 * 3600, new Map(), now, 2)
  const study = plan.find((item) => item.id === STUDY_REMINDER_ID)
  const sleep = plan.find((item) => item.id === SLEEP_REMINDER_ID)
  const todayGoal = plan.find((item) => item.id === goalReminderId(toISODate(now)))
  assert.deepEqual(study.schedule, { on: { hour: 9, minute: 15 }, repeats: true })
  assert.deepEqual(sleep.schedule, { on: { hour: 22, minute: 0 }, repeats: true })
  assert.ok(todayGoal)
  assert.equal(todayGoal.isExactNotification, false)
  assert.equal(plan.filter((item) => item.id === todayGoal.id).length, 1)
})

test('goal reminders use saved per-date study totals and omit dates at or above target', () => {
  const now = new Date(2026, 9, 25, 8, 0)
  const today = toISODate(now)
  const tomorrowDate = new Date(now)
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrow = toISODate(tomorrowDate)
  const plan = buildNativeReminderPlan(preferences, 6 * 3600, new Map([[today, 6 * 3600], [tomorrow, 5 * 3600]]), now, 2)
  assert.equal(plan.some((item) => item.id === goalReminderId(today)), false)
  assert.equal(plan.some((item) => item.id === goalReminderId(tomorrow)), true)
})

test('goal reminders skip past times, honor the scheduling horizon, and stop when disabled', () => {
  const now = new Date(2026, 9, 25, 20, 0)
  const plan = buildNativeReminderPlan({ ...preferences, studyReminderEnabled: false, sleepReminderEnabled: false }, 6 * 3600, new Map(), now, 3)
  assert.equal(plan.length, 2)
  assert.equal(plan.every((item) => 'at' in item.schedule && item.schedule.at > now), true)
  assert.equal(buildNativeReminderPlan({ ...preferences, enabled: false }, 6 * 3600, new Map(), now).length, 0)
})

test('native reminder identifiers are reserved and stable across calls', () => {
  const date = '2026-10-25'
  assert.equal(goalReminderId(date), goalReminderId(date))
  assert.equal(isManagedReminderId(goalReminderId(date)), true)
  assert.equal(isManagedReminderId(STUDY_REMINDER_ID), true)
  assert.equal(isManagedReminderId(SLEEP_REMINDER_ID), true)
  assert.equal(isManagedReminderId(741_003), false)
  assert.equal(isManagedReminderId(42), false)
})

test('goal reminders use local wall-clock time across a daylight-saving boundary', () => {
  const beforeSpringForward = new Date(2027, 2, 13, 8, 0)
  const plan = buildNativeReminderPlan({ ...preferences, studyReminderEnabled: false, sleepReminderEnabled: false, goalReminderTime: '09:15' }, 6 * 3600, new Map(), beforeSpringForward, 3)
  const postShift = plan.find((item) => 'at' in item.schedule && item.schedule.at.getDate() === 14)
  assert.ok(postShift && 'at' in postShift.schedule)
  assert.equal(postShift.schedule.at.getHours(), 9)
  assert.equal(postShift.schedule.at.getMinutes(), 15)
})
