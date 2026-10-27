import { addLocalDays, mondayOf, sumFocusSeconds } from './calendar.ts'
import { dateFromISO, toISODate } from '../../domain/date.ts'
import type { FocusSession, ISODate } from '../../domain/types'

export type StudyAnalytics = {
  weekStart: ISODate
  weekEnd: ISODate
  monthStart: ISODate
  monthEnd: ISODate
  weekSeconds: number
  monthSeconds: number
  dailyAverageSeconds: number
  weekSessionCount: number
  selectedDateSeconds: number
  selectedDateTargetPercent: number
  subjects: Array<{ subject: string; seconds: number }>
}

export type StudyDayComparison = { value: string; label: string }

/** Compare actual focused seconds; using seconds avoids rounding individual sessions before summing. */
export function compareStudyDays(todaySeconds: number, yesterdaySeconds: number): StudyDayComparison {
  const today = Math.max(0, todaySeconds)
  const yesterday = Math.max(0, yesterdaySeconds)
  if (today === 0 && yesterday === 0) return { value: 'No change yet', label: 'vs yesterday' }
  if (yesterday === 0) return { value: 'Started today', label: 'vs yesterday' }
  const change = Math.round(((today - yesterday) / yesterday) * 100)
  return { value: `${change > 0 ? '+' : ''}${change}%`, label: 'vs yesterday' }
}

export function calculateStudyAnalytics(sessions: FocusSession[], selectedDate: ISODate, dailyTargetSeconds: number): StudyAnalytics {
  const selected = dateFromISO(selectedDate)
  const weekStartDate = mondayOf(selected)
  const weekEndDate = addLocalDays(weekStartDate, 6)
  const monthStartDate = new Date(selected.getFullYear(), selected.getMonth(), 1)
  const monthEndDate = new Date(selected.getFullYear(), selected.getMonth() + 1, 0)
  const weekStart = toISODate(weekStartDate)
  const weekEnd = toISODate(weekEndDate)
  const monthStart = toISODate(monthStartDate)
  const monthEnd = toISODate(monthEndDate)
  const weeklySessions = sessions.filter((session) => session.date >= weekStart && session.date <= weekEnd)
  const monthSessions = sessions.filter((session) => session.date >= monthStart && session.date <= monthEnd)
  const weekSeconds = sumFocusSeconds(weeklySessions, weekStart, weekEnd)
  const monthSeconds = sumFocusSeconds(monthSessions, monthStart, monthEnd)
  const elapsedWeekDays = Math.min(7, Math.floor((selected.getTime() - weekStartDate.getTime()) / 86_400_000) + 1)
  const subjectSeconds = new Map<string, number>()
  for (const session of monthSessions) subjectSeconds.set(session.subject, (subjectSeconds.get(session.subject) ?? 0) + session.durationSeconds)
  const selectedDateSeconds = sessions.reduce((sum, session) => sum + (session.date === selectedDate ? session.durationSeconds : 0), 0)
  return {
    weekStart,
    weekEnd,
    monthStart,
    monthEnd,
    weekSeconds,
    monthSeconds,
    dailyAverageSeconds: Math.round(weekSeconds / elapsedWeekDays),
    weekSessionCount: weeklySessions.length,
    selectedDateSeconds,
    selectedDateTargetPercent: dailyTargetSeconds > 0 ? Math.min(100, Math.round(selectedDateSeconds / dailyTargetSeconds * 100)) : 0,
    subjects: [...subjectSeconds].map(([subject, seconds]) => ({ subject, seconds })).sort((a, b) => b.seconds - a.seconds || a.subject.localeCompare(b.subject)),
  }
}

