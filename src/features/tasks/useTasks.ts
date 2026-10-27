import { useCallback, useEffect, useRef, useState } from 'react'
import type { DailyLog, ISODate, Task } from '../../domain/types'
import { getDailyLog } from '../habits/repository'
import { emptyDailyLog } from '../habits/repository'
import { createTask as createLocalTask, deleteTask as deleteLocalTask, listTasks as listLocalTasks, setTaskCompletion as setLocalTaskCompletion, updateTask as updateLocalTask, type TaskInput } from './repository'
import { createCloudTask, deleteCloudTask, importLocalTasks, listCloudTasks, readTaskImportPlan, setCloudTaskCompletion, updateCloudTask } from './cloudSync'
import { TASK_ICON_SYNC_SETUP_MESSAGE } from './cloudSerialization'
import type { TaskImportPlan, TaskImportSummary } from './cloudSyncTypes'

function logTaskError(context: string, error: unknown) {
  if (import.meta.env.DEV) console.error(`[Lumi tasks] ${context}`, error)
}

function connectionMessage(action: 'load' | 'save' | 'import', cause?: unknown) {
  if (cause instanceof Error && cause.message === TASK_ICON_SYNC_SETUP_MESSAGE) return TASK_ICON_SYNC_SETUP_MESSAGE
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return action === 'load' ? 'You’re offline. Reconnect to load your tasks.' : 'You’re offline. Reconnect and try again; your change wasn’t saved.'
  }
  if (action === 'load') return 'Couldn’t load your tasks. Please try again.'
  if (action === 'import') return 'Couldn’t add those tasks. Please try again. Your saved records are still safe.'
  return 'Couldn’t save your task. Please try again.'
}

export function useTasks(date: ISODate, userId?: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [cloudStatus, setCloudStatus] = useState<'local' | 'checking' | 'connected' | 'error'>(userId ? 'checking' : 'local')
  const [importPlan, setImportPlan] = useState<TaskImportPlan | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importSaving, setImportSaving] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const requestId = useRef(0)

  const readCurrent = useCallback(async () => {
    if (userId) {
      const remote = await listCloudTasks(date, userId)
      return { tasks: remote.tasks, dailyLog: { ...emptyDailyLog(date), completedTaskIds: remote.completedIds } }
    }
    const [nextTasks, nextLog] = await Promise.all([listLocalTasks(date), getDailyLog(date)])
    return { tasks: nextTasks, dailyLog: nextLog }
  }, [date, userId])

  const reload = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true); setError(null)
    if (userId) setCloudStatus('checking')
    else setCloudStatus('local')
    try {
      const next = await readCurrent()
      if (requestId.current === id) { setTasks(next.tasks); setDailyLog(next.dailyLog); if (userId) setCloudStatus('connected') }
    } catch (cause) { logTaskError('Failed to load tasks', cause); if (requestId.current === id) { setError(connectionMessage('load', cause)); if (userId) setCloudStatus('error') } }
    finally { if (requestId.current === id) setLoading(false) }
  }, [readCurrent, userId])
  useEffect(() => { void reload(); return () => { requestId.current += 1 } }, [reload])

  const refreshImportPlan = useCallback(async () => {
    if (!userId) { setImportPlan(null); setImportError(null); return }
    setImportLoading(true); setImportError(null)
    try { setImportPlan(await readTaskImportPlan(userId)) }
    catch (cause) { logTaskError('Failed to prepare task import preview', cause); setImportError('Couldn’t prepare tasks from this device. Check your connection and try again.') }
    finally { setImportLoading(false) }
  }, [userId])
  useEffect(() => { void refreshImportPlan() }, [refreshImportPlan])

  const mutate = useCallback(async (operation: () => Promise<unknown>, success: string) => {
    setSaving(true); setError(null); setNotice(null)
    try { await operation() } catch (cause) { logTaskError('Failed to save task change', cause); setError(connectionMessage('save', cause)); if (userId) setCloudStatus('error'); setSaving(false); return false }
    try {
      const next = await readCurrent()
      setTasks(next.tasks); setDailyLog(next.dailyLog); if (userId) setCloudStatus('connected'); setNotice(success)
      if (userId) void refreshImportPlan()
      return true
    } catch (cause) { logTaskError('Saved task change but failed to refresh task list', cause); setError('Your change may have been saved, but Lumi couldn’t refresh your tasks. Reload to check.'); if (userId) setCloudStatus('error'); return false }
    finally { setSaving(false) }
  }, [readCurrent, refreshImportPlan, userId])

  const create = useCallback((input: TaskInput) => userId ? createCloudTask(input) : createLocalTask(input), [userId])
  const update = useCallback((id: string, input: TaskInput) => userId ? updateCloudTask(id, input) : updateLocalTask(id, input), [userId])
  const remove = useCallback((id: string) => userId ? deleteCloudTask(id) : deleteLocalTask(id), [userId])
  const setCompletion = useCallback((taskDate: ISODate, taskId: string, completed: boolean) => userId ? setCloudTaskCompletion(taskDate, taskId, completed) : setLocalTaskCompletion(taskDate, taskId, completed), [userId])
  const importTasks = useCallback(async (): Promise<TaskImportSummary | null> => {
    if (!userId) return null
    setImportSaving(true); setImportError(null); setNotice(null)
    try {
      const summary = await importLocalTasks(userId)
      await reload()
      setNotice(`Added ${summary.importedCount} task${summary.importedCount === 1 ? '' : 's'} from this device. Your original records were kept. ${summary.completionDateCount} completion date${summary.completionDateCount === 1 ? '' : 's'} added.`)
      await refreshImportPlan()
      return summary
    } catch (cause) {
      logTaskError('Task import did not finish', cause)
      setImportError(connectionMessage('import', cause))
      setCloudStatus('error')
      await refreshImportPlan()
      return null
    } finally { setImportSaving(false) }
  }, [refreshImportPlan, reload, userId])

  return { tasks, dailyLog, loading, saving, error, notice, reload, mutate, cloudMode: Boolean(userId), cloudStatus, createTask: create, updateTask: update, deleteTask: remove, setTaskCompletion: setCompletion, importPlan, importLoading, importSaving, importError, refreshImportPlan, importTasks }
}
