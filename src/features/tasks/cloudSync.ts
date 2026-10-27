import { getDatabase, openDatabaseForScope } from '../../data/database'
import type { ISODate, Task } from '../../domain/types'
import { supabase } from '../auth/supabaseClient'
import { validateTaskInput, type TaskInput } from './repository'
import { buildTaskImportPlan } from './cloudMapping'
import type { TaskImportPlan, TaskImportSummary } from './cloudSyncTypes'
import { buildTaskRpcWrite, isTaskIconSchemaError, mapCloudTaskRow, TASK_ICON_SYNC_SETUP_MESSAGE, toCloudTaskRow, type CloudTaskRow } from './cloudSerialization'
type LocalSnapshot = { tasks: Task[]; completions: Map<ISODate, Set<string>> }

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured. Set up authentication before syncing tasks.')
  return supabase
}

async function ensureTaskSyncReady(): Promise<void> {
  const { data, error } = await requireClient().rpc('lumi_task_sync_ready')
  if (error) throw new Error(`Task cloud-write setup is unavailable. Apply supabase/migrations/20261022000200_task_write_functions.sql, then retry. ${error.message}`)
  if (data !== true) throw new Error('Sign in again before syncing tasks.')
}

async function taskRowsForDate(date: ISODate, userId: string): Promise<CloudTaskRow[]> {
  const client = requireClient()
  const withIcon = await client.from('tasks').select('id,title,time,local_date,icon').eq('user_id', userId).eq('local_date', date).order('time')
  if (!withIcon.error) return (withIcon.data ?? []) as CloudTaskRow[]
  if (!isTaskIconSchemaError(withIcon.error)) throw new Error(`Could not load your cloud tasks. ${withIcon.error.message}`)
  const legacy = await client.from('tasks').select('id,title,time,local_date').eq('user_id', userId).eq('local_date', date).order('time')
  if (legacy.error) throw new Error(`Could not load your cloud tasks. ${legacy.error.message}`)
  return (legacy.data ?? []) as CloudTaskRow[]
}

async function readAllCloudTasks(userId: string): Promise<Task[]> {
  const client = requireClient()
  await ensureTaskSyncReady()
  const output: Task[] = []
  for (let start = 0; ; start += 1000) {
    const { data, error } = await client.from('tasks').select('id,title,time,local_date,icon')
      .eq('user_id', userId).order('local_date').range(start, start + 999)
    if (error && isTaskIconSchemaError(error)) {
      const legacy = await client.from('tasks').select('id,title,time,local_date')
        .eq('user_id', userId).order('local_date').range(start, start + 999)
      if (legacy.error) throw new Error(`Could not read cloud tasks. ${legacy.error.message}`)
      const rows = (legacy.data ?? []) as CloudTaskRow[]
      output.push(...rows.map(mapCloudTaskRow))
      if (rows.length < 1000) return output
      continue
    }
    if (error) throw new Error(`Could not read cloud tasks. ${error.message}`)
    const rows = (data ?? []) as CloudTaskRow[]
    output.push(...rows.map(mapCloudTaskRow))
    if (rows.length < 1000) return output
  }
}

async function readLocalSnapshot(): Promise<LocalSnapshot> {
  const accountDb = await getDatabase()
  const accountTasks = await accountDb.getAll('tasks')
  const accountLogs = await accountDb.getAll('dailyLogs')
  const deviceDb = await openDatabaseForScope('device')
  try {
    const [deviceTasks, deviceLogs] = await Promise.all([deviceDb.getAll('tasks'), deviceDb.getAll('dailyLogs')])
    const tasks = [...accountTasks, ...deviceTasks]
    const completions = new Map<ISODate, Set<string>>()
    for (const log of [...accountLogs, ...deviceLogs]) {
      const ids = completions.get(log.date) ?? new Set<string>()
      for (const taskId of log.completedTaskIds ?? []) ids.add(taskId)
      completions.set(log.date, ids)
    }
    return { tasks, completions }
  } finally {
    deviceDb.close()
  }
}

export async function listCloudTasks(date: ISODate, userId: string): Promise<{ tasks: Task[]; completedIds: string[] }> {
  const client = requireClient()
  await ensureTaskSyncReady()
  const [taskRows, logResult] = await Promise.all([
    taskRowsForDate(date, userId),
    client.from('daily_logs').select('completed_task_ids').eq('user_id', userId).eq('local_date', date).maybeSingle(),
  ])
  if (logResult.error) throw new Error(`Could not load cloud task completion status. ${logResult.error.message}`)
  return { tasks: taskRows.map(mapCloudTaskRow), completedIds: logResult.data?.completed_task_ids ?? [] }
}

export async function createCloudTask(input: TaskInput): Promise<Task> {
  const task: Task = { ...validateTaskInput(input), id: crypto.randomUUID() }
  const client = requireClient()
  await ensureTaskSyncReady()
  const write = buildTaskRpcWrite(task.id, input)
  const { error } = await client.rpc(write.name, write.args)
  if (isTaskIconSchemaError(error) && task.icon) throw new Error(TASK_ICON_SYNC_SETUP_MESSAGE)
  if (error) throw new Error(`Could not save task to your account. ${error.message}`)
  return task
}

export async function updateCloudTask(id: string, input: TaskInput): Promise<Task> {
  const client = requireClient()
  const task: Task = { ...validateTaskInput(input), id }
  await ensureTaskSyncReady()
  const iconWasProvided = Object.prototype.hasOwnProperty.call(input, 'icon')
  const write = buildTaskRpcWrite(id, input, iconWasProvided)
  const result = await client.rpc(write.name, write.args)
  const { error } = result
  if (isTaskIconSchemaError(error) && iconWasProvided) throw new Error(TASK_ICON_SYNC_SETUP_MESSAGE)
  if (error) throw new Error(`Could not update your cloud task. ${error.message}`)
  return task
}

export async function deleteCloudTask(id: string): Promise<void> {
  const client = requireClient()
  await ensureTaskSyncReady()
  const { error } = await client.rpc('delete_lumi_task', { p_task_id: id })
  if (error) throw new Error(`Could not delete your cloud task. ${error.message}`)
}

export async function setCloudTaskCompletion(date: ISODate, taskId: string, completed: boolean): Promise<void> {
  const client = requireClient()
  await ensureTaskSyncReady()
  const { error } = await client.rpc('set_lumi_task_completion', { p_task_id: taskId, p_local_date: date, p_completed: completed })
  if (error) throw new Error(`Could not update cloud task completion. ${error.message}`)
}

export async function importLocalTasks(userId: string): Promise<TaskImportSummary> {
  const [local, cloudBefore] = await Promise.all([readLocalSnapshot(), readAllCloudTasks(userId)])
  const plan = buildTaskImportPlan(local.tasks, cloudBefore)
  const client = requireClient()
  let importedCount = 0
  for (let offset = 0; offset < plan.addTasks.length; offset += 100) {
    const batch = plan.addTasks.slice(offset, offset + 100)
    const { data, error } = await client.from('tasks')
      .upsert(batch.map((task) => toCloudTaskRow(task, userId)), { onConflict: 'id', ignoreDuplicates: true })
      .select('id')
    if (error && batch.some((task) => task.icon) && isTaskIconSchemaError(error)) throw new Error(TASK_ICON_SYNC_SETUP_MESSAGE)
    if (error) throw new Error(`Imported ${importedCount} tasks before an error. Local records are still intact; retry to continue. ${error.message}`)
    importedCount += data?.length ?? 0
  }

  const cloudAfter = await readAllCloudTasks(userId)
  const verified = buildTaskImportPlan(local.tasks, cloudAfter)
  const validIds = new Set(verified.completionTasks.map((task) => task.id))
  const dates = new Map<ISODate, string[]>()
  for (const [date, ids] of local.completions) {
    const matching = [...ids].filter((id) => validIds.has(id))
    if (matching.length) dates.set(date, matching)
  }

  let completionDateCount = 0
  for (const [date, ids] of dates) {
    for (const id of ids) {
      const { error } = await client.rpc('set_lumi_task_completion', { p_task_id: id, p_local_date: date, p_completed: true })
      if (error) throw new Error(`Tasks were uploaded, but completion history could not be fully imported. Local records remain intact; retry the import. ${error.message}`)
    }
    completionDateCount += 1
  }
  return {
    importedCount,
    duplicateCount: plan.duplicateCount,
    conflictCount: verified.conflictCount,
    unsupportedIdCount: verified.unsupportedIdCount,
    completionDateCount,
  }
}

export async function readTaskImportPlan(userId: string): Promise<TaskImportPlan> {
  const [local, cloud] = await Promise.all([readLocalSnapshot(), readAllCloudTasks(userId)])
  return buildTaskImportPlan(local.tasks, cloud)
}
