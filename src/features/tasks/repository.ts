import { getDatabase, type LumiDatabase } from '../../data/database.ts'
import { toISODate } from '../../domain/date.ts'
import type { ISODate, Task } from '../../domain/types'
import { emptyDailyLog } from '../habits/repository.ts'

export type TaskInput = Pick<Task, 'title' | 'time' | 'date'> & { icon?: string | null }
type ValidTaskInput = Pick<Task, 'title' | 'time' | 'date' | 'icon'>

export function validateTaskInput(input: TaskInput): ValidTaskInput {
  const title = input.title.trim()
  if (!title) throw new Error('Give your task a name.')
  if (title.length > 80) throw new Error('Task names must be 80 characters or fewer.')
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new Error('Choose a valid time.')
  const parsedDate = new Date(`${input.date}T00:00:00`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(parsedDate.getTime()) || toISODate(parsedDate) !== input.date) throw new Error('Choose a valid local date.')
  if (input.icon && (!/^[a-z0-9-]{1,40}$/i.test(input.icon))) throw new Error('Choose a valid task icon.')
  const { icon, ...taskFields } = input
  return { ...taskFields, title, ...(icon ? { icon } : {}) }
}

export async function listTasks(date: ISODate, db?: LumiDatabase): Promise<Task[]> {
  const database = db ?? await getDatabase()
  return (await database.getAllFromIndex('tasks', 'by-date', date)).sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title))
}

export async function createTask(input: TaskInput, db?: LumiDatabase): Promise<Task> {
  const database = db ?? await getDatabase()
  const task: Task = { ...validateTaskInput(input), id: crypto.randomUUID() }
  await database.add('tasks', task)
  return task
}

export async function updateTask(id: string, input: TaskInput, db?: LumiDatabase): Promise<Task> {
  const database = db ?? await getDatabase()
  const transaction = database.transaction(['tasks', 'dailyLogs'], 'readwrite')
  const store = transaction.objectStore('tasks')
  const current = await store.get(id)
  if (!current) { await transaction.done; throw new Error('This task no longer exists. Refresh and try again.') }
  const iconWasProvided = Object.prototype.hasOwnProperty.call(input, 'icon')
  const task: Task = { ...current, ...validateTaskInput(input) }
  if (iconWasProvided) {
    if (input.icon) task.icon = input.icon
    else delete task.icon
  }
  await store.put(task)
  if (current.date !== task.date) {
    const oldLogStore = transaction.objectStore('dailyLogs')
    const oldLog = await oldLogStore.get(current.date)
    if (oldLog?.completedTaskIds?.includes(id)) await oldLogStore.put({ ...oldLog, completedTaskIds: oldLog.completedTaskIds.filter((taskId) => taskId !== id) })
  }
  await transaction.done
  return task
}

export async function deleteTask(id: string, db?: LumiDatabase): Promise<void> {
  const database = db ?? await getDatabase()
  const transaction = database.transaction(['tasks', 'dailyLogs'], 'readwrite')
  const tasks = transaction.objectStore('tasks')
  await tasks.delete(id)
  const logs = transaction.objectStore('dailyLogs')
  for (const log of await logs.getAll()) {
    if ((log.completedTaskIds ?? []).includes(id)) await logs.put({ ...log, completedTaskIds: log.completedTaskIds.filter((taskId) => taskId !== id) })
  }
  await transaction.done
}

export async function setTaskCompletion(date: ISODate, taskId: string, completed: boolean, db?: LumiDatabase) {
  const database = db ?? await getDatabase()
  const transaction = database.transaction(['tasks', 'dailyLogs'], 'readwrite')
  const task = await transaction.objectStore('tasks').get(taskId)
  if (!task || task.date !== date) { await transaction.done; throw new Error('This task is not available on the selected date.') }
  const logs = transaction.objectStore('dailyLogs')
  const log = (await logs.get(date)) ?? emptyDailyLog(date)
  const completedIds = new Set(log.completedTaskIds ?? [])
  if (completed) completedIds.add(taskId); else completedIds.delete(taskId)
  const updated = { ...log, completedTaskIds: [...completedIds] }
  await logs.put(updated)
  await transaction.done
  return updated
}
