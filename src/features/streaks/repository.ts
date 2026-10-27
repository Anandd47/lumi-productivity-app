import { getDatabase, type LumiDatabase } from '../../data/database.ts'
import { dateFromISO, previousLocalDate, toISODate } from '../../domain/date.ts'
import type { DailyLog, GraceDay, Habit, ISODate } from '../../domain/types'
import { qualifiesForStreak } from './streak.ts'

function nextLocalDate(date: ISODate): ISODate {
  const next = dateFromISO(date)
  next.setDate(next.getDate() + 1)
  return toISODate(next)
}

export async function loadStreakHistory(db?: LumiDatabase) {
  const database = db ?? await getDatabase()
  const [habits, dailyLogs, graceDays] = await Promise.all([database.getAll('habits'), database.getAll('dailyLogs'), database.getAll('graceDays')])
  return { habits, dailyLogs, graceDays }
}

function validateMissedDate(date: ISODate, today: ISODate) {
  const parsed = dateFromISO(date)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || toISODate(parsed) !== date) throw new Error('Choose a valid local date.')
  if (date.slice(0, 7) !== today.slice(0, 7)) throw new Error('Grace days do not roll over; choose a missed date from this calendar month.')
  if (date > previousLocalDate(today)) throw new Error('A grace day can only protect a day that has already passed.')
}

export async function useGraceDay(date: ISODate, db?: LumiDatabase, now = new Date()): Promise<GraceDay> {
  const database = db ?? await getDatabase()
  const today = toISODate(now)
  validateMissedDate(date, today)
  const month = date.slice(0, 7) as GraceDay['month']
  const transaction = database.transaction(['habits', 'dailyLogs', 'graceDays'], 'readwrite')
  const [habits, logs, existing] = await Promise.all([
    transaction.objectStore('habits').getAll(),
    transaction.objectStore('dailyLogs').getAll(),
    transaction.objectStore('graceDays').get(month),
  ])
  if (existing) { await transaction.done; throw new Error(`This month’s grace day was already used on ${existing.usedOn}.`) }
  const history = new Map(logs.map((log) => [log.date, log]))
  if (qualifiesForStreak(habits as Habit[], history.get(date) as DailyLog | undefined, date)) {
    await transaction.done
    throw new Error('This date already qualifies; grace days can only protect a missed day.')
  }
  const qualifyingDates = [...new Set((logs as DailyLog[])
    .filter((log) => log.date <= today && qualifiesForStreak(habits as Habit[], log, log.date))
    .map((log) => log.date))].sort()
  const previousQualifying = [...qualifyingDates].reverse().find((qualifyingDate) => qualifyingDate < date)
  const nextQualifying = qualifyingDates.find((qualifyingDate) => qualifyingDate > date)
  if (!previousQualifying || !nextQualifying || nextLocalDate(previousQualifying) !== date || nextLocalDate(date) !== nextQualifying) {
    await transaction.done
    throw new Error('A grace day can only bridge one missed date between qualifying days.')
  }
  const grace: GraceDay = { month, usedOn: date }
  await transaction.objectStore('graceDays').add(grace)
  await transaction.done
  return grace
}

export async function removeGraceDay(month: GraceDay['month'], db?: LumiDatabase): Promise<void> {
  const database = db ?? await getDatabase()
  const transaction = database.transaction('graceDays', 'readwrite')
  await transaction.objectStore('graceDays').delete(month)
  await transaction.done
}
