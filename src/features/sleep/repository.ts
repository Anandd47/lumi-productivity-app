import { getDatabase, type LumiDatabase } from '../../data/database.ts'
import { dateFromISO, toISODate } from '../../domain/date.ts'
import type { ISODate, LumiSettings, SleepRecord } from '../../domain/types'
import { getSettings } from '../focus/repository.ts'
import { DEFAULT_SLEEP_TARGET_MINUTES } from './constants.ts'

export type SleepInput = Pick<SleepRecord, 'date' | 'startTime' | 'wakeTime'>

function localDateTime(date: ISODate, time: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose a valid wake-up date.')
  const calendarDate = dateFromISO(date)
  if (toISODate(calendarDate) !== date) throw new Error('Choose a valid wake-up date.')
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Enter a valid sleep start and wake-up time.')
  const [hour, minute] = time.split(':').map(Number)
  const result = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate(), hour, minute)
  if (result.getHours() !== hour || result.getMinutes() !== minute) throw new Error('That local time does not exist on the selected date.')
  return result
}

export function validateSleepInput(input: SleepInput): Omit<SleepRecord, 'id'> {
  const wakeDate = dateFromISO(input.date)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || toISODate(wakeDate) !== input.date) throw new Error('Choose a valid wake-up date.')
  const wake = localDateTime(input.date, input.wakeTime)
  const bedDate = input.startTime > input.wakeTime
    ? toISODate(new Date(wakeDate.getFullYear(), wakeDate.getMonth(), wakeDate.getDate() - 1))
    : input.date
  const start = localDateTime(bedDate, input.startTime)
  const durationMinutes = Math.round((wake.getTime() - start.getTime()) / 60_000)
  if (durationMinutes <= 0) throw new Error('Wake-up must be later than sleep start. Choose the date you woke up; overnight sleep is handled automatically.')
  if (durationMinutes > 24 * 60) throw new Error('A sleep entry cannot be longer than 24 hours.')
  return { date: input.date, startTime: input.startTime, wakeTime: input.wakeTime, startedAt: start.getTime(), endedAt: wake.getTime(), durationMinutes }
}

function ensureNoOverlap(candidate: Omit<SleepRecord, 'id'>, records: SleepRecord[], exceptId?: string) {
  for (const current of records) {
    if (current.id === exceptId) continue
    if (current.date === candidate.date) throw new Error('A sleep record already exists for this wake-up date. Edit the existing entry instead.')
    if (candidate.startedAt < current.endedAt && candidate.endedAt > current.startedAt) throw new Error('This sleep period overlaps another saved sleep record.')
  }
}

export async function listSleepRecords(db?: LumiDatabase): Promise<SleepRecord[]> {
  const database = db ?? await getDatabase()
  return (await database.getAll('sleepRecords')).sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt)
}

export async function listSleepRecordsForDate(date: ISODate, db?: LumiDatabase): Promise<SleepRecord[]> {
  const database = db ?? await getDatabase()
  return (await database.getAllFromIndex('sleepRecords', 'by-date', date)).sort((a, b) => a.startedAt - b.startedAt)
}

export async function createSleepRecord(input: SleepInput, db?: LumiDatabase): Promise<SleepRecord> {
  const database = db ?? await getDatabase()
  const transaction = database.transaction('sleepRecords', 'readwrite')
  const store = transaction.objectStore('sleepRecords')
  const validated = validateSleepInput(input)
  ensureNoOverlap(validated, await store.getAll())
  const record: SleepRecord = { ...validated, id: crypto.randomUUID() }
  await store.add(record)
  await transaction.done
  return record
}

export async function updateSleepRecord(id: string, input: SleepInput, db?: LumiDatabase): Promise<SleepRecord> {
  const database = db ?? await getDatabase()
  const transaction = database.transaction('sleepRecords', 'readwrite')
  const store = transaction.objectStore('sleepRecords')
  const current = await store.get(id)
  if (!current) { await transaction.done; throw new Error('This sleep record no longer exists. Refresh and try again.') }
  const validated = validateSleepInput(input)
  ensureNoOverlap(validated, await store.getAll(), id)
  const updated: SleepRecord = { ...validated, id }
  await store.put(updated)
  await transaction.done
  return updated
}

export async function deleteSleepRecord(id: string, db?: LumiDatabase): Promise<void> {
  const database = db ?? await getDatabase()
  const transaction = database.transaction('sleepRecords', 'readwrite')
  await transaction.objectStore('sleepRecords').delete(id)
  await transaction.done
}

export async function setSleepTargetMinutes(minutes: number, db?: LumiDatabase): Promise<LumiSettings> {
  if (!Number.isInteger(minutes) || minutes < 60 || minutes > 24 * 60) throw new Error('Choose a sleep goal from 1 to 24 hours.')
  const database = db ?? await getDatabase()
  const current = await getSettings(database)
  const updated = { ...current, sleepTargetMinutes: minutes }
  await database.put('settings', updated)
  return updated
}

export { DEFAULT_SLEEP_TARGET_MINUTES }
