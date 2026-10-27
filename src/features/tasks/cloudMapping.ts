import type { Task } from '../../domain/types'
import type { TaskImportPlan } from './cloudSyncTypes'

export function isCloudTaskId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function sameTask(a: Task, b: Task): boolean {
  return a.id === b.id && a.title === b.title && a.time === b.time && a.date === b.date && (a.icon ?? '') === (b.icon ?? '')
}

export function buildTaskImportPlan(localTasks: Task[], cloudTasks: Task[]): TaskImportPlan {
  const localById = new Map<string, Task>()
  const blockedIds = new Set<string>()
  let duplicateCount = 0
  let conflictCount = 0
  let unsupportedIdCount = 0

  for (const task of localTasks) {
    if (!isCloudTaskId(task.id)) { unsupportedIdCount += 1; continue }
    const prior = localById.get(task.id)
    if (!prior) localById.set(task.id, task)
    else if (sameTask(prior, task)) duplicateCount += 1
    else { blockedIds.add(task.id); conflictCount += 1 }
  }

  const cloudById = new Map(cloudTasks.map((task) => [task.id, task]))
  const addTasks: Task[] = []
  const completionTasks: Task[] = []
  for (const task of localById.values()) {
    if (blockedIds.has(task.id)) continue
    const cloudTask = cloudById.get(task.id)
    if (!cloudTask) { addTasks.push(task); completionTasks.push(task) }
    else if (sameTask(task, cloudTask)) { duplicateCount += 1; completionTasks.push(task) }
    else conflictCount += 1
  }

  return { localTaskCount: localTasks.length, addTasks, completionTasks, duplicateCount, conflictCount, unsupportedIdCount }
}
