import type { Habit, ISODate } from '../../domain/types'

export function isHabitActiveOnDate(habit: Habit, date: ISODate): boolean {
  return habit.createdAt <= date && (!habit.archivedAt || date < habit.archivedAt)
}

export interface CoreProgress {
  activeCoreCount: number
  completedCoreCount: number
  percentage: number
  isEmpty: boolean
}

export function calculateCoreProgress(habits: Habit[], completedHabitIds: string[], date: ISODate): CoreProgress {
  const activeCoreHabits = habits.filter((habit) => habit.kind === 'core' && isHabitActiveOnDate(habit, date))
  const completed = new Set(completedHabitIds)
  const completedCoreCount = activeCoreHabits.filter((habit) => completed.has(habit.id)).length
  const activeCoreCount = activeCoreHabits.length

  return {
    activeCoreCount,
    completedCoreCount,
    percentage: activeCoreCount === 0 ? 0 : Math.round((completedCoreCount / activeCoreCount) * 100),
    isEmpty: activeCoreCount === 0,
  }
}
