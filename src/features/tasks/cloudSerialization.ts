import type { ISODate, Task } from '../../domain/types'
import { validateTaskInput, type TaskInput } from './repository.ts'

export type CloudTaskRow = { id: string; title: string; time: string; local_date: string; icon?: string | null }
export type TaskRpcName = 'save_lumi_task' | 'save_lumi_task_with_icon'
export type TaskRpcArguments = {
  p_task_id: string
  p_title: string
  p_time: string
  p_local_date: ISODate
  p_icon?: string | null
}

export const TASK_ICON_SYNC_SETUP_MESSAGE = 'Task icon sync needs a one-time account update. Apply Lumi’s task icon migration, then retry. The task form and saved local tasks remain unchanged.'

export function mapCloudTaskRow(row: CloudTaskRow): Task {
  return { id: row.id, title: row.title, time: row.time, date: row.local_date as ISODate, ...(row.icon ? { icon: row.icon } : {}) }
}

export function toCloudTaskRow(task: Task, userId: string) {
  return { id: task.id, user_id: userId, title: task.title, time: task.time, local_date: task.date, ...(task.icon ? { icon: task.icon } : {}) }
}

export function buildTaskRpcWrite(taskId: string, input: TaskInput, includeExplicitNullIcon = false): { name: TaskRpcName; args: TaskRpcArguments } {
  const task = validateTaskInput(input)
  const includeIcon = Boolean(task.icon) || (includeExplicitNullIcon && Object.prototype.hasOwnProperty.call(input, 'icon'))
  const args: TaskRpcArguments = {
    p_task_id: taskId,
    p_title: task.title,
    p_time: task.time,
    p_local_date: task.date,
    ...(includeIcon ? { p_icon: task.icon ?? null } : {}),
  }
  return { name: includeIcon ? 'save_lumi_task_with_icon' : 'save_lumi_task', args }
}

export function isTaskIconSchemaError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const message = error.message?.toLowerCase() ?? ''
  if (error.code === 'PGRST202') return message.includes('save_lumi_task_with_icon')
  if (error.code === '42703' || error.code === 'PGRST204') return message.includes('icon')
  return message.includes('schema cache') && (message.includes('icon') || message.includes('save_lumi_task_with_icon'))
}
