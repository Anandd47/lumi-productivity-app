import { getDatabase, type LumiDatabase } from '../../data/database.ts'
import { dateFromISO, toISODate } from '../../domain/date.ts'
import type { LumiSettings, NotificationPreferences, ProfilePreferences } from '../../domain/types'
import { getSettings, normalizeSettings } from '../focus/repository.ts'

export type ProfileInput = ProfilePreferences & Pick<LumiSettings, 'studyTargetSeconds' | 'sleepTargetMinutes' | 'waterGoalGlasses'>

export function validateProfileInput(input: ProfileInput): ProfileInput {
  const displayName = input.displayName.trim()
  if (displayName.length > 48) throw new Error('Your display name must be 48 characters or fewer.')
  if (!['orange', 'violet', 'blue', 'rose'].includes(input.avatarColor)) throw new Error('Choose one of the available avatar colors.')
  if (!Number.isInteger(input.studyTargetSeconds) || input.studyTargetSeconds < 3600 || input.studyTargetSeconds > 86400) throw new Error('Choose a daily study goal from 1 to 24 hours.')
  if (!Number.isInteger(input.sleepTargetMinutes) || input.sleepTargetMinutes < 60 || input.sleepTargetMinutes > 1440) throw new Error('Choose a daily sleep goal from 1 to 24 hours.')
  if (!Number.isInteger(input.waterGoalGlasses) || input.waterGoalGlasses < 1 || input.waterGoalGlasses > 30) throw new Error('Choose a water goal from 1 to 30 glasses.')
  return { ...input, displayName }
}

export async function saveProfile(input: ProfileInput, db?: LumiDatabase): Promise<LumiSettings> {
  const database = db ?? await getDatabase()
  const valid = validateProfileInput(input)
  const current = await getSettings(database)
  const settings = normalizeSettings({ ...current, studyTargetSeconds: valid.studyTargetSeconds, sleepTargetMinutes: valid.sleepTargetMinutes, waterGoalGlasses: valid.waterGoalGlasses, profile: { displayName: valid.displayName, avatarColor: valid.avatarColor } })
  await database.put('settings', settings)
  return settings
}

export function validateNotificationPreferences(value: NotificationPreferences): NotificationPreferences {
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/
  if (![value.studyReminderTime, value.goalReminderTime, value.sleepReminderTime].every((time) => timePattern.test(time))) throw new Error('Choose valid 24-hour reminder times.')
  return {
    enabled: Boolean(value.enabled),
    studyReminderEnabled: Boolean(value.studyReminderEnabled),
    studyReminderTime: value.studyReminderTime,
    goalReminderEnabled: Boolean(value.goalReminderEnabled),
    goalReminderTime: value.goalReminderTime,
    sleepReminderEnabled: Boolean(value.sleepReminderEnabled),
    sleepReminderTime: value.sleepReminderTime,
    ...(value.lastStudyReminderDate ? { lastStudyReminderDate: value.lastStudyReminderDate } : {}),
    ...(value.lastGoalReminderDate ? { lastGoalReminderDate: value.lastGoalReminderDate } : {}),
    ...(value.lastSleepReminderDate ? { lastSleepReminderDate: value.lastSleepReminderDate } : {}),
  }
}

export async function saveNotificationPreferences(value: NotificationPreferences, db?: LumiDatabase): Promise<LumiSettings> {
  const database = db ?? await getDatabase()
  const current = await getSettings(database)
  const preferences = validateNotificationPreferences({
    ...value,
    lastStudyReminderDate: current.notifications?.lastStudyReminderDate ?? value.lastStudyReminderDate,
    lastGoalReminderDate: current.notifications?.lastGoalReminderDate ?? value.lastGoalReminderDate,
    lastSleepReminderDate: current.notifications?.lastSleepReminderDate ?? value.lastSleepReminderDate,
  })
  const settings = normalizeSettings({ ...current, notifications: preferences })
  await database.put('settings', settings)
  return settings
}

export type ReminderKind = 'study' | 'goal' | 'sleep'
export async function claimReminder(kind: ReminderKind, date: string, db?: LumiDatabase): Promise<boolean> {
  const database = db ?? await getDatabase()
  const transaction = database.transaction('settings', 'readwrite')
  const store = transaction.objectStore('settings')
  const settings = normalizeSettings(await store.get('settings'))
  const prefs = settings.notifications!
  const enabled = kind === 'study' ? prefs.studyReminderEnabled : kind === 'goal' ? prefs.goalReminderEnabled : prefs.sleepReminderEnabled
  const lastKey = kind === 'study' ? 'lastStudyReminderDate' : kind === 'goal' ? 'lastGoalReminderDate' : 'lastSleepReminderDate'
  if (!prefs.enabled || !enabled || prefs[lastKey] === date) { await transaction.done; return false }
  prefs[lastKey] = date as `${number}-${number}-${number}`
  await store.put({ ...settings, notifications: prefs })
  await transaction.done
  return true
}

export const DATA_STORE_NAMES = ['habits', 'dailyLogs', 'graceDays', 'tasks', 'focusSessions', 'timerState', 'settings', 'sleepRecords', 'waterEntries', 'activityEntries'] as const
export type LumiBackup = { format: 'lumi-backup'; version: 1; exportedAt: string; stores: Record<(typeof DATA_STORE_NAMES)[number], unknown[]> }

export async function exportLumiData(db?: LumiDatabase): Promise<LumiBackup> {
  const database = db ?? await getDatabase()
  await getSettings(database)
  const pairs = await Promise.all(DATA_STORE_NAMES.map(async (name) => [name, await database.getAll(name)] as const))
  return { format: 'lumi-backup', version: 1, exportedAt: new Date().toISOString(), stores: Object.fromEntries(pairs) as LumiBackup['stores'] }
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const isString = (value: unknown): value is string => typeof value === 'string'
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isISODate = (value: unknown) => {
  if (!isString(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = dateFromISO(value as `${number}-${number}-${number}`)
  return toISODate(date) === value
}
function isValidSettingsRecord(value: Record<string, unknown>) {
  if (value.id !== 'settings' || !isFiniteNumber(value.studyTargetSeconds) || !Number.isInteger(value.studyTargetSeconds) || value.studyTargetSeconds < 3600 || value.studyTargetSeconds > 86400 || !isFiniteNumber(value.sleepTargetMinutes) || !Number.isInteger(value.sleepTargetMinutes) || value.sleepTargetMinutes < 60 || value.sleepTargetMinutes > 1440 || !isFiniteNumber(value.waterGoalGlasses) || !Number.isInteger(value.waterGoalGlasses) || value.waterGoalGlasses < 1 || value.waterGoalGlasses > 30) return false
  if (value.profile !== undefined) {
    const profile = value.profile
    if (!isObject(profile) || !isString(profile.displayName) || profile.displayName.length > 48 || !['orange', 'violet', 'blue', 'rose'].includes(String(profile.avatarColor))) return false
  }
  if (value.notifications !== undefined) {
    const notifications = value.notifications
    const validTime = (time: unknown) => isString(time) && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    if (!isObject(notifications) || typeof notifications.enabled !== 'boolean' || typeof notifications.studyReminderEnabled !== 'boolean' || typeof notifications.goalReminderEnabled !== 'boolean' || typeof notifications.sleepReminderEnabled !== 'boolean' || !validTime(notifications.studyReminderTime) || !validTime(notifications.goalReminderTime) || !validTime(notifications.sleepReminderTime)) return false
    for (const key of ['lastStudyReminderDate', 'lastGoalReminderDate', 'lastSleepReminderDate']) if (notifications[key] !== undefined && !isISODate(notifications[key])) return false
  }
  return true
}

function isValidRecord(store: (typeof DATA_STORE_NAMES)[number], value: unknown): boolean {
  if (!isObject(value)) return false
  switch (store) {
    case 'habits': return isString(value.id) && isString(value.name) && isISODate(value.createdAt) && ['core', 'optional'].includes(String(value.kind)) && ['orange', 'violet', 'blue'].includes(String(value.color)) && Number.isInteger(value.targetPerWeek) && Number(value.targetPerWeek) >= 1 && Number(value.targetPerWeek) <= 7
    case 'dailyLogs': return isISODate(value.date) && Array.isArray(value.completedHabitIds) && value.completedHabitIds.every(isString) && (value.completedTaskIds === undefined || (Array.isArray(value.completedTaskIds) && value.completedTaskIds.every(isString)))
    case 'graceDays': return isString(value.month) && /^\d{4}-\d{2}$/.test(value.month) && isString(value.usedOn) && isISODate(value.usedOn) && value.month === value.usedOn.slice(0, 7)
    case 'tasks': return isString(value.id) && isString(value.title) && isISODate(value.date) && isString(value.time) && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)
    case 'focusSessions': return isString(value.id) && isISODate(value.date) && isString(value.subject) && isFiniteNumber(value.durationSeconds) && value.durationSeconds > 0 && isFiniteNumber(value.startedAt) && isFiniteNumber(value.endedAt)
    case 'timerState': return value.id === 'current' && ['pomodoro', 'countdown', 'stopwatch'].includes(String(value.kind)) && ['focus', 'break'].includes(String(value.phase)) && ['idle', 'running', 'paused'].includes(String(value.status)) && isString(value.subject) && ['focusSeconds', 'breakSeconds', 'countdownSeconds', 'remainingSeconds', 'accumulatedSeconds', 'updatedAt'].every((key) => isFiniteNumber(value[key]))
    case 'settings': return isValidSettingsRecord(value)
    case 'sleepRecords': return isString(value.id) && isISODate(value.date) && isString(value.startTime) && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.startTime) && isString(value.wakeTime) && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.wakeTime) && isFiniteNumber(value.durationMinutes) && value.durationMinutes > 0 && value.durationMinutes <= 1440 && isFiniteNumber(value.startedAt) && isFiniteNumber(value.endedAt)
    case 'waterEntries': return isString(value.id) && isISODate(value.date) && Number.isInteger(value.glasses) && Number(value.glasses) > 0 && Number(value.glasses) <= 100
    case 'activityEntries': return isString(value.id) && isISODate(value.date) && ['Walking', 'Running', 'Cycling', 'Strength training', 'Yoga', 'Other'].includes(String(value.type)) && Number.isInteger(value.durationMinutes) && Number(value.durationMinutes) > 0
  }
}

export function validateLumiBackup(value: unknown): LumiBackup {
  if (!isObject(value) || value.format !== 'lumi-backup' || value.version !== 1 || !isObject(value.stores)) throw new Error('This file is not a supported Lumi backup.')
  const stores: Record<string, unknown[]> = {}
  for (const name of DATA_STORE_NAMES) {
    const records = value.stores[name]
    if (records === undefined) { stores[name] = []; continue }
    if (!Array.isArray(records) || records.some((record) => !isValidRecord(name, record))) throw new Error(`The backup contains invalid ${name} records. Nothing was changed.`)
    const keys = records.map((record) => name === 'dailyLogs' ? (record as Record<string, unknown>).date : name === 'graceDays' ? (record as Record<string, unknown>).month : (record as Record<string, unknown>).id)
    if (new Set(keys).size !== keys.length) throw new Error(`The backup contains duplicate ${name} records. Nothing was changed.`)
    stores[name] = records
  }
  const settings = stores.settings
  if (settings.length > 1) throw new Error('The backup contains conflicting settings records. Nothing was changed.')
  if (settings.length === 1) settings[0] = normalizeSettings(settings[0] as Partial<LumiSettings>)
  else settings.push(normalizeSettings(undefined))
  return { format: 'lumi-backup', version: 1, exportedAt: isString(value.exportedAt) ? value.exportedAt : new Date().toISOString(), stores: stores as LumiBackup['stores'] }
}

export async function replaceLumiData(backup: LumiBackup, db?: LumiDatabase): Promise<void> {
  const database = db ?? await getDatabase()
  const validBackup = validateLumiBackup(backup)
  const transaction = database.transaction([...DATA_STORE_NAMES], 'readwrite')
  const clearing = DATA_STORE_NAMES.map((name) => transaction.objectStore(name).clear())
  await Promise.all(clearing)
  const writes = DATA_STORE_NAMES.flatMap((name) => validBackup.stores[name].map((record) => transaction.objectStore(name).put(record as never)))
  await Promise.all(writes)
  await transaction.done
}

export async function getLocalDataCounts(db?: LumiDatabase): Promise<Record<string, number>> {
  const database = db ?? await getDatabase()
  const pairs = await Promise.all(DATA_STORE_NAMES.map(async (name) => [name, await database.count(name)] as const))
  return Object.fromEntries(pairs)
}
