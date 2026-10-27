import { getDatabase, type LumiDatabase } from '../../data/database.ts'
import { toISODate } from '../../domain/date.ts'
import type { AvatarColor, FocusSession, FocusTimerState, ISODate, LumiSettings, NotificationPreferences, ProfilePreferences } from '../../domain/types'
import { DEFAULT_SLEEP_TARGET_MINUTES } from '../sleep/constants.ts'
import { DEFAULT_WATER_GOAL_GLASSES } from '../health/constants.ts'

export const DEFAULT_STUDY_TARGET_SECONDS = 6 * 60 * 60
export const DEFAULT_FOCUS_SECONDS = 25 * 60
export const DEFAULT_BREAK_SECONDS = 5 * 60
export const DEFAULT_COUNTDOWN_SECONDS = 30 * 60

export const DEFAULT_PROFILE: ProfilePreferences = { displayName: '', avatarColor: 'orange' }
export const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  enabled: false,
  studyReminderEnabled: false,
  studyReminderTime: '09:00',
  goalReminderEnabled: false,
  goalReminderTime: '18:00',
  sleepReminderEnabled: false,
  sleepReminderTime: '22:00',
}

export function normalizeSettings(value: Partial<LumiSettings> | undefined): LumiSettings {
  const colors: AvatarColor[] = ['orange', 'violet', 'blue', 'rose']
  const profileValue = value?.profile
  const notificationValue = value?.notifications
  const studyTarget = value?.studyTargetSeconds
  const sleepTarget = value?.sleepTargetMinutes
  const waterGoal = value?.waterGoalGlasses
  const validTime = (time: unknown, fallback: string) => typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : fallback
  const settings: LumiSettings = {
    id: 'settings',
    studyTargetSeconds: typeof studyTarget === 'number' && Number.isInteger(studyTarget) && studyTarget >= 3600 && studyTarget <= 86400 ? studyTarget : DEFAULT_STUDY_TARGET_SECONDS,
    sleepTargetMinutes: typeof sleepTarget === 'number' && Number.isInteger(sleepTarget) && sleepTarget >= 60 && sleepTarget <= 1440 ? sleepTarget : DEFAULT_SLEEP_TARGET_MINUTES,
    waterGoalGlasses: typeof waterGoal === 'number' && Number.isInteger(waterGoal) && waterGoal >= 1 && waterGoal <= 30 ? waterGoal : DEFAULT_WATER_GOAL_GLASSES,
    profile: {
      displayName: typeof profileValue?.displayName === 'string' ? profileValue.displayName.trim().slice(0, 48) : DEFAULT_PROFILE.displayName,
      avatarColor: colors.includes(profileValue?.avatarColor as AvatarColor) ? profileValue!.avatarColor as AvatarColor : DEFAULT_PROFILE.avatarColor,
    },
    notifications: {
      ...DEFAULT_NOTIFICATIONS,
      enabled: notificationValue?.enabled === true,
      studyReminderEnabled: notificationValue?.studyReminderEnabled === true,
      studyReminderTime: validTime(notificationValue?.studyReminderTime, DEFAULT_NOTIFICATIONS.studyReminderTime),
      goalReminderEnabled: notificationValue?.goalReminderEnabled === true,
      goalReminderTime: validTime(notificationValue?.goalReminderTime, DEFAULT_NOTIFICATIONS.goalReminderTime),
      sleepReminderEnabled: notificationValue?.sleepReminderEnabled === true,
      sleepReminderTime: validTime(notificationValue?.sleepReminderTime, DEFAULT_NOTIFICATIONS.sleepReminderTime),
      ...(typeof notificationValue?.lastStudyReminderDate === 'string' ? { lastStudyReminderDate: notificationValue.lastStudyReminderDate as ISODate } : {}),
      ...(typeof notificationValue?.lastGoalReminderDate === 'string' ? { lastGoalReminderDate: notificationValue.lastGoalReminderDate as ISODate } : {}),
      ...(typeof notificationValue?.lastSleepReminderDate === 'string' ? { lastSleepReminderDate: notificationValue.lastSleepReminderDate as ISODate } : {}),
    },
  }
  return settings
}

export function createDefaultTimerState(now = Date.now()): FocusTimerState {
  return { id: 'current', kind: 'pomodoro', phase: 'focus', status: 'idle', subject: 'General', focusSeconds: DEFAULT_FOCUS_SECONDS, breakSeconds: DEFAULT_BREAK_SECONDS, countdownSeconds: DEFAULT_COUNTDOWN_SECONDS, remainingSeconds: DEFAULT_FOCUS_SECONDS, accumulatedSeconds: 0, sessionStartedAt: null, startedAt: null, endsAt: null, updatedAt: now }
}

export async function getTimerState(db?: LumiDatabase): Promise<FocusTimerState> {
  const database = db ?? await getDatabase()
  const existing = await database.get('timerState', 'current')
  if (existing) return existing
  const initial = createDefaultTimerState()
  await database.put('timerState', initial)
  return initial
}

export async function saveTimerState(state: FocusTimerState, db?: LumiDatabase): Promise<void> {
  const database = db ?? await getDatabase()
  await database.put('timerState', { ...state, updatedAt: Date.now() })
}

export async function commitTimerTransition(state: FocusTimerState, session?: Omit<FocusSession, 'id'>, db?: LumiDatabase): Promise<void> {
  const database = db ?? await getDatabase()
  const transaction = database.transaction(['timerState', 'focusSessions'], 'readwrite')
  await transaction.objectStore('timerState').put({ ...state, updatedAt: Date.now() })
  if (session && session.durationSeconds > 0) {
    await transaction.objectStore('focusSessions').add({ ...session, subject: session.subject.trim().slice(0, 64) || 'General', id: crypto.randomUUID() })
  }
  await transaction.done
}

export async function listFocusSessions(date: ISODate, db?: LumiDatabase): Promise<FocusSession[]> {
  const database = db ?? await getDatabase()
  return (await database.getAllFromIndex('focusSessions', 'by-date', date)).sort((a, b) => a.startedAt - b.startedAt)
}

/** Read saved study history for reminder reconciliation without changing its source of truth. */
export async function listAllFocusSessions(db?: LumiDatabase): Promise<FocusSession[]> {
  const database = db ?? await getDatabase()
  return database.getAll('focusSessions')
}

export async function deleteFocusSession(id: string, db?: LumiDatabase): Promise<void> {
  const database = db ?? await getDatabase()
  const transaction = database.transaction('focusSessions', 'readwrite')
  await transaction.objectStore('focusSessions').delete(id)
  await transaction.done
}

export async function recordFocusSession(input: Omit<FocusSession, 'id'>, db?: LumiDatabase): Promise<FocusSession> {
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds < 1) throw new Error('A focus session must contain at least one second.')
  const subject = input.subject.trim().slice(0, 64) || 'General'
  const database = db ?? await getDatabase()
  const session = { ...input, subject, id: crypto.randomUUID() }
  await database.add('focusSessions', session)
  return session
}

export async function getSettings(db?: LumiDatabase): Promise<LumiSettings> {
  const database = db ?? await getDatabase()
  const existing = await database.get('settings', 'settings')
  if (existing) {
    const settings = normalizeSettings(existing)
    if (JSON.stringify(settings) !== JSON.stringify(existing)) await database.put('settings', settings)
    return settings
  }
  const settings = normalizeSettings(undefined)
  await database.put('settings', settings)
  return settings
}

export async function setStudyTargetSeconds(seconds: number, db?: LumiDatabase): Promise<LumiSettings> {
  if (!Number.isInteger(seconds) || seconds < 60 * 60 || seconds > 24 * 60 * 60) throw new Error('Choose a daily study target from 1 to 24 hours.')
  const database = db ?? await getDatabase()
  const current = await getSettings(database)
  const settings = { ...current, studyTargetSeconds: seconds }
  await database.put('settings', settings)
  return settings
}

export function focusSessionDate(startedAt: number): ISODate {
  return toISODate(new Date(startedAt))
}
