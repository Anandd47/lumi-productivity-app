import { getDatabase, type LumiDatabase } from '../../data/database.ts'
import { dateFromISO, toISODate } from '../../domain/date.ts'
import type { ActivityEntry, ActivityType, ISODate, LumiSettings, WaterEntry } from '../../domain/types'
import { getSettings } from '../focus/repository.ts'
import { DEFAULT_WATER_GOAL_GLASSES } from './constants.ts'

export type WaterInput = Pick<WaterEntry, 'date' | 'glasses'>
export type ActivityInput = Pick<ActivityEntry, 'date' | 'type' | 'durationMinutes'>
export const ACTIVITY_TYPES: ActivityType[] = ['Walking', 'Running', 'Cycling', 'Strength training', 'Yoga', 'Other']

function validateDate(date: ISODate) {
  const parsed = dateFromISO(date)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || toISODate(parsed) !== date) throw new Error('Choose a valid local date.')
}

export function validateWaterInput(input: WaterInput): WaterInput {
  validateDate(input.date)
  if (!Number.isInteger(input.glasses) || input.glasses < 1 || input.glasses > 100) throw new Error('Enter a whole number of glasses from 1 to 100.')
  return input
}

export function validateActivityInput(input: ActivityInput): ActivityInput {
  validateDate(input.date)
  if (!ACTIVITY_TYPES.includes(input.type)) throw new Error('Choose a valid activity type.')
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 1440) throw new Error('Activity duration must be from 1 to 1440 minutes.')
  return input
}

export async function listWaterEntries(db?: LumiDatabase): Promise<WaterEntry[]> {
  const database = db ?? await getDatabase()
  return (await database.getAll('waterEntries')).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
}

export async function listActivityEntries(db?: LumiDatabase): Promise<ActivityEntry[]> {
  const database = db ?? await getDatabase()
  return (await database.getAll('activityEntries')).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
}

export async function createWaterEntry(input: WaterInput, db?: LumiDatabase): Promise<WaterEntry> {
  const database = db ?? await getDatabase()
  const entry: WaterEntry = { ...validateWaterInput(input), id: crypto.randomUUID(), createdAt: Date.now() }
  await database.add('waterEntries', entry)
  return entry
}

export async function updateWaterEntry(id: string, input: WaterInput, db?: LumiDatabase): Promise<WaterEntry> {
  const database = db ?? await getDatabase()
  const transaction = database.transaction('waterEntries', 'readwrite')
  const store = transaction.objectStore('waterEntries')
  const current = await store.get(id)
  if (!current) { await transaction.done; throw new Error('This water entry no longer exists. Refresh and try again.') }
  const updated: WaterEntry = { ...current, ...validateWaterInput(input) }
  await store.put(updated)
  await transaction.done
  return updated
}

export async function deleteWaterEntry(id: string, db?: LumiDatabase): Promise<void> {
  const database = db ?? await getDatabase()
  const transaction = database.transaction('waterEntries', 'readwrite')
  await transaction.objectStore('waterEntries').delete(id)
  await transaction.done
}

export async function createActivityEntry(input: ActivityInput, db?: LumiDatabase): Promise<ActivityEntry> {
  const database = db ?? await getDatabase()
  const entry: ActivityEntry = { ...validateActivityInput(input), id: crypto.randomUUID(), createdAt: Date.now() }
  await database.add('activityEntries', entry)
  return entry
}

export async function updateActivityEntry(id: string, input: ActivityInput, db?: LumiDatabase): Promise<ActivityEntry> {
  const database = db ?? await getDatabase()
  const transaction = database.transaction('activityEntries', 'readwrite')
  const store = transaction.objectStore('activityEntries')
  const current = await store.get(id)
  if (!current) { await transaction.done; throw new Error('This activity entry no longer exists. Refresh and try again.') }
  const updated: ActivityEntry = { ...current, ...validateActivityInput(input) }
  await store.put(updated)
  await transaction.done
  return updated
}

export async function deleteActivityEntry(id: string, db?: LumiDatabase): Promise<void> {
  const database = db ?? await getDatabase()
  const transaction = database.transaction('activityEntries', 'readwrite')
  await transaction.objectStore('activityEntries').delete(id)
  await transaction.done
}

export async function setWaterGoalGlasses(glasses: number, db?: LumiDatabase): Promise<LumiSettings> {
  if (!Number.isInteger(glasses) || glasses < 1 || glasses > 30) throw new Error('Choose a daily water goal from 1 to 30 glasses.')
  const database = db ?? await getDatabase()
  const updated = { ...await getSettings(database), waterGoalGlasses: glasses }
  await database.put('settings', updated)
  return updated
}

export { DEFAULT_WATER_GOAL_GLASSES }
