import { dateFromISO, toISODate } from '../../domain/date.ts'
import type { FocusSession, ISODate } from '../../domain/types'

export type ActivitySources = {
  studyDates: Set<ISODate>
  taskDates: Set<ISODate>
  completedDates: Set<ISODate>
}

export function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function shiftMonth(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

/** Move a selected local calendar date by one month, clamping at month end. */
export function shiftISODateMonth(date: ISODate, amount: number): ISODate {
  const current = dateFromISO(date)
  const targetMonth = new Date(current.getFullYear(), current.getMonth() + amount, 1)
  const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate()
  return toISODate(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(current.getDate(), lastDay)))
}

/** Returns a Monday-first grid padded to full weeks, with local-midnight dates. */
export function getMonthGrid(month: Date): Date[] {
  const first = monthStart(month)
  const mondayOffset = (first.getDay() + 6) % 7
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset)
  const dayCount = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const total = Math.ceil((mondayOffset + dayCount) / 7) * 7
  return Array.from({ length: total }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index))
}

export function mondayOf(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7))
  return result
}

export function addLocalDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
}

export function focusSecondsForDate(sessions: FocusSession[], date: ISODate): number {
  return sessions.reduce((sum, session) => sum + (session.date === date ? session.durationSeconds : 0), 0)
}

export function studyIntensity(seconds: number): 0 | 1 | 2 | 3 | 4 {
  if (seconds <= 0) return 0
  const minutes = seconds / 60
  if (minutes < 30) return 1
  if (minutes < 60) return 2
  if (minutes < 120) return 3
  return 4
}

export function buildStudyHeatmap(sessions: FocusSession[], today = new Date()): { start: ISODate; end: ISODate; dates: Date[]; secondsByDate: Map<ISODate, number> } {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const firstMonth = new Date(end.getFullYear(), end.getMonth() - 11, 1)
  const start = mondayOf(firstMonth)
  const gridEnd = addLocalDays(end, 6 - ((end.getDay() + 6) % 7))
  const dates: Date[] = []
  for (let date = start; date <= gridEnd; date = addLocalDays(date, 1)) dates.push(date)
  const startKey = toISODate(firstMonth)
  const endKey = toISODate(end)
  const secondsByDate = new Map<ISODate, number>()
  for (const session of sessions) {
    if (session.date < startKey || session.date > endKey) continue
    secondsByDate.set(session.date, (secondsByDate.get(session.date) ?? 0) + session.durationSeconds)
  }
  return { start: startKey, end: endKey, dates, secondsByDate }
}

export function activityOnDate(sources: ActivitySources, date: ISODate): boolean {
  return sources.studyDates.has(date) || sources.taskDates.has(date) || sources.completedDates.has(date)
}

export function sumFocusSeconds(sessions: FocusSession[], start: ISODate, end: ISODate): number {
  return sessions.reduce((sum, session) => sum + (session.date >= start && session.date <= end ? session.durationSeconds : 0), 0)
}

