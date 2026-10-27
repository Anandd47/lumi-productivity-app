import { dateFromISO, previousLocalDate, toISODate } from '../../domain/date.ts'
import type { DailyLog, GraceDay, Habit, ISODate } from '../../domain/types'
import { isHabitActiveOnDate } from '../habits/progress.ts'

const MILESTONES = [7, 14, 30, 100] as const

function nextLocalDate(date: ISODate): ISODate {
  const next = dateFromISO(date)
  next.setDate(next.getDate() + 1)
  return toISODate(next)
}

export function completedCoreCount(habits: Habit[], log: DailyLog | undefined, date: ISODate): number {
  if (!log) return 0
  const completed = new Set(log.completedHabitIds ?? [])
  return habits.filter((habit) => habit.kind === 'core' && isHabitActiveOnDate(habit, date) && completed.has(habit.id)).length
}

export function qualifiesForStreak(habits: Habit[], log: DailyLog | undefined, date: ISODate): boolean {
  return completedCoreCount(habits, log, date) >= 2
}

export function calculateStreakStats(habits: Habit[], dailyLogs: DailyLog[], graceDays: GraceDay[], today: ISODate) {
  const logByDate = new Map(dailyLogs.map((log) => [log.date, log]))
  const graceByDate = new Set(graceDays.filter((grace) => grace.usedOn <= today).map((grace) => grace.usedOn))
  const coreHabitCount = habits.filter((habit) => habit.kind === 'core' && isHabitActiveOnDate(habit, today)).length
  const configured = coreHabitCount >= 2
  const qualifyingDates = [...new Set(dailyLogs.filter((log) => log.date <= today && qualifiesForStreak(habits, log, log.date)).map((log) => log.date))].sort()

  let longestStreak = 0
  let run = 0
  let previousQualifying: ISODate | null = null
  for (const date of qualifyingDates) {
    if (!previousQualifying) run = 1
    else {
      let cursor = nextLocalDate(previousQualifying)
      let connected = true
      while (cursor < date) {
        if (!graceByDate.has(cursor)) connected = false
        cursor = nextLocalDate(cursor)
      }
      run = connected ? run + 1 : 1
    }
    longestStreak = Math.max(longestStreak, run)
    previousQualifying = date
  }

  // Today remains in progress until it qualifies. Current streaks count qualifying days only;
  // an explicitly saved grace date bridges the chain but never increases this count.
  let cursor = qualifiesForStreak(habits, logByDate.get(today), today) ? today : previousLocalDate(today)
  let currentStreak = 0
  while (qualifyingDates.includes(cursor) || graceByDate.has(cursor)) {
    if (qualifyingDates.includes(cursor)) currentStreak += 1
    cursor = previousLocalDate(cursor)
  }
  if (!configured) currentStreak = 0

  const month = today.slice(0, 7) as GraceDay['month']
  const currentMonthQualifyingDays = qualifyingDates.filter((date) => date.slice(0, 7) === month).length
  const currentMonthGrace = graceDays.find((grace) => grace.month === month)
  const reachedMilestones = MILESTONES.filter((milestone) => longestStreak >= milestone)
  const nextMilestone = MILESTONES.find((milestone) => currentStreak < milestone)
  const milestoneMessage = MILESTONES.includes(currentStreak as typeof MILESTONES[number]) && currentStreak === longestStreak
    ? `New longest streak: ${currentStreak} qualifying days.`
    : null

  return { today, coreHabitCount, configured, qualifyingDates, currentStreak, longestStreak, currentMonthQualifyingDays, currentMonthGrace, reachedMilestones, nextMilestone, milestoneMessage }
}

export { MILESTONES }
