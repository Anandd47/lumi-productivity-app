import { dateFromISO, toISODate } from '../../domain/date.ts'
import type { ISODate, NotificationPreferences } from '../../domain/types'

export const STUDY_REMINDER_ID = 741_001
export const SLEEP_REMINDER_ID = 741_002
export const TEST_NOTIFICATION_ID = 741_003
const GOAL_REMINDER_ID_BASE = 1_000_000_000

export type NativeReminder = {
  id: number
  title: string
  body: string
  schedule: { on: { hour: number; minute: number }; repeats: true } | { at: Date }
  isExactNotification: false
  channelId: string
}

function parseTime(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) throw new Error('Choose a valid reminder time.')
  return { hour, minute }
}

export function goalReminderId(date: ISODate): number {
  const [year, month, day] = date.split('-').map(Number)
  const serial = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
  return GOAL_REMINDER_ID_BASE + serial
}

export function isManagedReminderId(id: number): boolean {
  return id === STUDY_REMINDER_ID || id === SLEEP_REMINDER_ID || (id >= GOAL_REMINDER_ID_BASE && id < GOAL_REMINDER_ID_BASE + 1_000_000)
}

export function buildNativeReminderPlan(
  preferences: NotificationPreferences,
  studyTargetSeconds: number,
  focusedSecondsByDate: ReadonlyMap<ISODate, number>,
  now = new Date(),
  goalHorizonDays = 30,
): NativeReminder[] {
  if (!preferences.enabled) return []
  const reminders: NativeReminder[] = []
  if (preferences.studyReminderEnabled) reminders.push({
    id: STUDY_REMINDER_ID,
    title: 'A little focus goes a long way',
    body: 'Take a moment for a Lumi study session.',
    schedule: { on: parseTime(preferences.studyReminderTime), repeats: true },
    isExactNotification: false,
    channelId: 'lumi-reminders',
  })
  if (preferences.sleepReminderEnabled) reminders.push({
    id: SLEEP_REMINDER_ID,
    title: 'Wind down for sleep',
    body: 'A calm bedtime can support your sleep goal.',
    schedule: { on: parseTime(preferences.sleepReminderTime), repeats: true },
    isExactNotification: false,
    channelId: 'lumi-reminders',
  })
  if (preferences.goalReminderEnabled) {
    const firstDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    for (let offset = 0; offset < goalHorizonDays; offset += 1) {
      const localDate = new Date(firstDate)
      localDate.setDate(firstDate.getDate() + offset)
      const dateKey = toISODate(localDate)
      const { hour, minute } = parseTime(preferences.goalReminderTime)
      const at = dateFromISO(dateKey)
      at.setHours(hour, minute, 0, 0)
      if (at <= now || (focusedSecondsByDate.get(dateKey) ?? 0) >= studyTargetSeconds) continue
      reminders.push({
        id: goalReminderId(dateKey),
        title: 'Your daily study goal',
        body: 'There is still time for a focused study session today.',
        schedule: { at },
        isExactNotification: false,
        channelId: 'lumi-reminders',
      })
    }
  }
  return reminders
}
