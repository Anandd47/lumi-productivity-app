import { toISODate } from '../../domain/date.ts'
import type { Habit, ISODate } from '../../domain/types'
import { isHabitActiveOnDate } from '../habits/progress.ts'

export type StreakDayState = 'outside' | 'completed' | 'grace' | 'missed' | 'today' | 'future' | 'untracked'

export interface StreakCalendarDay {
  date: ISODate
  day: number
  state: StreakDayState
}

/** Monday-first local calendar month, derived only from saved qualifying/grace dates. */
export function buildStreakMonth(today: ISODate, qualifyingDates: ISODate[], graceDates: ISODate[], habits: Habit[]): StreakCalendarDay[] {
  const [year, month] = today.split('-').map(Number)
  const first = new Date(year, month - 1, 1)
  const leading = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()
  const cellCount = Math.ceil((leading + daysInMonth) / 7) * 7
  const qualifying = new Set(qualifyingDates)
  const grace = new Set(graceDates)

  return Array.from({ length: cellCount }, (_, index) => {
    const dateValue = new Date(year, month - 1, index - leading + 1)
    const date = toISODate(dateValue)
    const day = dateValue.getDate()
    if (date.slice(0, 7) !== today.slice(0, 7)) return { date, day, state: 'outside' as const }
    if (date > today) return { date, day, state: 'future' as const }
    if (qualifying.has(date)) return { date, day, state: 'completed' as const }
    if (grace.has(date)) return { date, day, state: 'grace' as const }
    if (date === today) return { date, day, state: 'today' as const }
    const activeCoreCount = habits.filter((habit) => habit.kind === 'core' && isHabitActiveOnDate(habit, date)).length
    return { date, day, state: activeCoreCount >= 2 ? 'missed' as const : 'untracked' as const }
  })
}
