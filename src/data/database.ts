import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from 'idb'
import type { ActivityEntry, DailyLog, FocusSession, FocusTimerState, GraceDay, Habit, ISODate, LumiSettings, SleepRecord, Task, WaterEntry } from '../domain/types'

export interface LumiDB extends DBSchema {
  habits: { key: string; value: Habit; indexes: { 'by-created': ISODate } }
  dailyLogs: { key: ISODate; value: DailyLog }
  graceDays: { key: `${number}-${number}`; value: GraceDay }
  tasks: { key: string; value: Task; indexes: { 'by-date': ISODate } }
  focusSessions: { key: string; value: FocusSession; indexes: { 'by-date': ISODate } }
  timerState: { key: 'current'; value: FocusTimerState }
  settings: { key: 'settings'; value: LumiSettings }
  sleepRecords: { key: string; value: SleepRecord; indexes: { 'by-date': ISODate } }
  waterEntries: { key: string; value: WaterEntry; indexes: { 'by-date': ISODate } }
  activityEntries: { key: string; value: ActivityEntry; indexes: { 'by-date': ISODate } }
}

export type LumiDatabase = IDBPDatabase<LumiDB>

export async function upgradeLumiDatabase(
  db: LumiDatabase,
  oldVersion: number,
  transaction?: IDBPTransaction<LumiDB, ('habits' | 'dailyLogs' | 'graceDays' | 'tasks' | 'focusSessions' | 'timerState' | 'settings' | 'sleepRecords' | 'waterEntries' | 'activityEntries')[], 'versionchange'>,
): Promise<void> {
  if (oldVersion < 1) {
    const habits = db.createObjectStore('habits', { keyPath: 'id' })
    habits.createIndex('by-created', 'createdAt')
    db.createObjectStore('dailyLogs', { keyPath: 'date' })
    db.createObjectStore('graceDays', { keyPath: 'month' })
  }

  // Phase 1 habits predate the core/optional distinction; keep them as core habits.
  if (oldVersion >= 1 && oldVersion < 2 && transaction) {
    const store = transaction.objectStore('habits')
    let cursor = await store.openCursor()
    while (cursor) {
      await cursor.update({ ...cursor.value, kind: cursor.value.kind ?? 'core' })
      cursor = await cursor.continue()
    }
  }

  if (oldVersion < 3) {
    const tasks = db.createObjectStore('tasks', { keyPath: 'id' })
    tasks.createIndex('by-date', 'date')
  }

  if (oldVersion < 4) {
    const sessions = db.createObjectStore('focusSessions', { keyPath: 'id' })
    sessions.createIndex('by-date', 'date')
    db.createObjectStore('timerState', { keyPath: 'id' })
    db.createObjectStore('settings', { keyPath: 'id' })
  }

  if (oldVersion < 5) {
    const sleepRecords = db.createObjectStore('sleepRecords', { keyPath: 'id' })
    sleepRecords.createIndex('by-date', 'date')
  }

  if (oldVersion >= 4 && oldVersion < 5 && transaction) {
    const settings = transaction.objectStore('settings')
    let cursor = await settings.openCursor()
    while (cursor) {
      await cursor.update({ ...cursor.value, sleepTargetMinutes: cursor.value.sleepTargetMinutes ?? 480 })
      cursor = await cursor.continue()
    }
  }

  if (oldVersion < 6) {
    db.createObjectStore('waterEntries', { keyPath: 'id' }).createIndex('by-date', 'date')
    db.createObjectStore('activityEntries', { keyPath: 'id' }).createIndex('by-date', 'date')
  }

  if (oldVersion >= 4 && oldVersion < 6 && transaction) {
    const settings = transaction.objectStore('settings')
    let cursor = await settings.openCursor()
    while (cursor) {
      await cursor.update({ ...cursor.value, sleepTargetMinutes: cursor.value.sleepTargetMinutes ?? 480, waterGoalGlasses: cursor.value.waterGoalGlasses ?? 8 })
      cursor = await cursor.continue()
    }
  }
}

let database: Promise<IDBPDatabase<LumiDB>> | undefined
let databaseScope = 'device'

/** Keep each signed-in account's offline cache in a separate browser database. */
export function setDatabaseScope(scope: string): void {
  const next = scope === 'device' ? 'device' : `user-${scope.replace(/[^a-zA-Z0-9_-]/g, '')}`
  if (next === databaseScope) return
  const previous = database
  database = undefined
  databaseScope = next
  void previous?.then((db) => db.close()).catch(() => undefined)
}

export function getDatabaseName(scope = databaseScope): string {
  return scope === 'device' ? 'lumi-local' : `lumi-local-${scope}`
}

/** Open an explicitly named local scope for one-time, user-approved imports. Close it when finished. */
export function openDatabaseForScope(scope: string): Promise<LumiDatabase> {
  return openDB<LumiDB>(getDatabaseName(scope), 6, {
    upgrade: (db, oldVersion, _newVersion, transaction) => upgradeLumiDatabase(db, oldVersion, transaction),
  })
}

/** Open the local Lumi store on demand. Importing the app does not access browser storage. */
export function getDatabase(): Promise<LumiDatabase> {
  if (!database) {
    database = openDatabaseForScope(databaseScope).catch((error: unknown) => {
      database = undefined
      throw error
    })
  }
  return database
}
