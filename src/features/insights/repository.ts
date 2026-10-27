import type { DailyLog, FocusSession, Habit, ISODate, LumiSettings, Task } from '../../domain/types'
import { getDatabase } from '../../data/database.ts'
import { getSettings } from '../focus/repository.ts'

export type InsightsData = {
  sessions: FocusSession[]
  tasks: Task[]
  habits: Habit[]
  dailyLogs: DailyLog[]
  settings: LumiSettings
}

/** Read analytics inputs from the same stores used by Focus, Tasks, and Habits. */
export async function loadInsightsData(): Promise<InsightsData> {
  const db = await getDatabase()
  const [sessions, tasks, habits, dailyLogs, settings] = await Promise.all([
    db.getAll('focusSessions'),
    db.getAll('tasks'),
    db.getAll('habits'),
    db.getAll('dailyLogs'),
    getSettings(db),
  ])
  return { sessions, tasks, habits, dailyLogs, settings }
}

export type SelectedDayData = {
  sessions: FocusSession[]
  focusedSeconds: number
  tasks: Array<{ task: Task; completed: boolean }>
  habits: Array<{ habit: Habit; completed: boolean }>
}

export function getSelectedDayData(data: InsightsData, date: ISODate): SelectedDayData {
  const sessions = data.sessions.filter((session) => session.date === date).sort((a, b) => a.startedAt - b.startedAt)
  const log = data.dailyLogs.find((item) => item.date === date)
  const completedTaskIds = new Set(log?.completedTaskIds ?? [])
  const completedHabitIds = new Set(log?.completedHabitIds ?? [])
  const tasks = data.tasks.filter((task) => task.date === date).sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title)).map((task) => ({ task, completed: completedTaskIds.has(task.id) }))
  const habits = data.habits.filter((habit) => habit.createdAt <= date && (!habit.archivedAt || date < habit.archivedAt)).sort((a, b) => a.name.localeCompare(b.name)).map((habit) => ({ habit, completed: completedHabitIds.has(habit.id) }))
  return { sessions, focusedSeconds: sessions.reduce((total, session) => total + session.durationSeconds, 0), tasks, habits }
}

