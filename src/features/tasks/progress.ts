import type { Task } from '../../domain/types'

export function calculateTaskProgress(tasks: Task[], completedIds: string[]) {
  const ids = new Set(completedIds)
  const completedCount = tasks.filter((task) => ids.has(task.id)).length
  return { totalCount: tasks.length, completedCount, percentage: tasks.length === 0 ? 0 : Math.round(completedCount / tasks.length * 100) }
}
