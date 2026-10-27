import { getDatabase, type LumiDatabase } from '../../data/database.ts'
import { toISODate } from '../../domain/date.ts'
import type { DailyLog, Habit, ISODate } from '../../domain/types'
import { isHabitActiveOnDate } from './progress.ts'

export type HabitInput = Pick<Habit, 'name' | 'kind' | 'icon' | 'color' | 'targetPerWeek'>

export function validateHabitInput(input: HabitInput): HabitInput {
  const name = input.name.trim()
  if (!name) throw new Error('Give your habit a name.')
  if (name.length > 48) throw new Error('Habit names must be 48 characters or fewer.')
  if (!Number.isInteger(input.targetPerWeek) || input.targetPerWeek < 1 || input.targetPerWeek > 7) {
    throw new Error('Choose a weekly target from 1 to 7 days.')
  }
  if (input.kind !== 'core' && input.kind !== 'optional') throw new Error('Choose core or optional.')
  return { ...input, name }
}

export async function listHabits(db?: LumiDatabase): Promise<Habit[]> {
  const database = db ?? await getDatabase()
  return (await database.getAll('habits')).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name))
}

export async function createHabit(input: HabitInput, db?: LumiDatabase, now = new Date()): Promise<Habit> {
  const database = db ?? await getDatabase()
  const habit: Habit = { ...validateHabitInput(input), id: crypto.randomUUID(), createdAt: toISODate(now) }
  await database.put('habits', habit)
  return habit
}

export async function updateHabit(id: string, input: HabitInput, db?: LumiDatabase): Promise<Habit> {
  const database = db ?? await getDatabase()
  const validated = validateHabitInput(input)
  const transaction = database.transaction('habits', 'readwrite')
  const store = transaction.objectStore('habits')
  const existing = await store.get(id)
  if (!existing) {
    await transaction.done
    throw new Error('This habit no longer exists. Refresh and try again.')
  }
  const updated: Habit = { ...existing, ...validated }
  await store.put(updated)
  await transaction.done
  return updated
}

export async function deleteHabit(id: string, db?: LumiDatabase): Promise<void> {
  const database = db ?? await getDatabase()
  const transaction = database.transaction(['habits', 'dailyLogs'], 'readwrite')
  const habitsStore = transaction.objectStore('habits')
  const logsStore = transaction.objectStore('dailyLogs')
  const existing = await habitsStore.get(id)
  if (!existing) {
    await transaction.done
    return
  }

  await habitsStore.delete(id)
  const logs = await logsStore.getAll()
  for (const log of logs) {
    if (log.completedHabitIds.includes(id)) {
      await logsStore.put({ ...log, completedHabitIds: log.completedHabitIds.filter((habitId) => habitId !== id) })
    }
  }
  await transaction.done
}

export function emptyDailyLog(date: ISODate): DailyLog {
  return { date, completedHabitIds: [], focusMinutes: 0, studyMinutes: 0, healthChecks: 0, completedPriorityIds: [], completedTaskIds: [] }
}

export async function getDailyLog(date: ISODate, db?: LumiDatabase): Promise<DailyLog> {
  const database = db ?? await getDatabase()
  const log = (await database.get('dailyLogs', date)) ?? emptyDailyLog(date)
  return { ...log, completedTaskIds: log.completedTaskIds ?? [] }
}

export async function setHabitCompletion(date: ISODate, habitId: string, completed: boolean, db?: LumiDatabase): Promise<DailyLog> {
  const database = db ?? await getDatabase()
  const transaction = database.transaction(['habits', 'dailyLogs'], 'readwrite')
  const habit = await transaction.objectStore('habits').get(habitId)
  if (!habit) {
    await transaction.done
    throw new Error('This habit no longer exists. Refresh and try again.')
  }
  if (!isHabitActiveOnDate(habit, date)) {
    await transaction.done
    throw new Error('This habit is not active on the selected date.')
  }

  const logs = transaction.objectStore('dailyLogs')
  const log = (await logs.get(date)) ?? emptyDailyLog(date)
  const completedIds = new Set(log.completedHabitIds)
  if (completed) completedIds.add(habitId)
  else completedIds.delete(habitId)
  const updated = { ...log, completedHabitIds: [...completedIds] }
  await logs.put(updated)
  await transaction.done
  return updated
}
