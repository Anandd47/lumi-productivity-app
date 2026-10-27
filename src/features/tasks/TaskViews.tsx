import { useState, type FormEvent } from 'react'
import { CalendarDays, Check, Circle, Pencil, Plus, Target, Trash2, X } from 'lucide-react'
import type { ISODate, Task } from '../../domain/types'
import { formatISODate, toISODate } from '../../domain/date'
import { useLumiConfirm } from '../../components/ConfirmDialog'
import type { TaskInput } from './repository'
import type { TaskImportPlan, TaskImportSummary } from './cloudSyncTypes'
import { ActivityIcon, ActivityIconPicker, TASK_ICON_OPTIONS } from '../../components/ActivityIconPicker'
import './tasks.css'

export type TaskViewData = {
  tasks: Task[]; completedIds: string[]; date: ISODate; loading: boolean; saving: boolean; error: string | null; notice: string | null
  cloudMode: boolean; importPlan: TaskImportPlan | null; importLoading: boolean; importSaving: boolean; importError: string | null
  createTask: (input: TaskInput) => Promise<Task>; updateTask: (id: string, input: TaskInput) => Promise<Task>; deleteTask: (id: string) => Promise<void>
  refreshImportPlan: () => Promise<void>; importTasks: () => Promise<TaskImportSummary | null>
  mutate: (operation: () => Promise<unknown>, successMessage: string) => Promise<boolean>
  reload: () => Promise<void>; onToggle: (task: Task, completed: boolean) => void
}

export function TaskDashboardCard({ data }: { data: TaskViewData }) {
  const [adding, setAdding] = useState(false)
  async function save(input: TaskInput) {
    return data.mutate(() => data.createTask(input), 'Task saved successfully.')
  }
  return <section className="priorities-card glass" aria-labelledby="priorities-heading">
    <div className="section-heading dashboard-data-header"><div className="heading-title dashboard-data-title"><span className="dashboard-data-icon target-icon"><Target size={20} /></span><h2 id="priorities-heading">{data.date === toISODate(new Date()) ? 'Today’s Priorities' : `Tasks · ${formatISODate(data.date)}`}</h2></div>
      <div className="dashboard-data-actions"><span className="left-count" aria-label={`${data.tasks.filter((task) => !data.completedIds.includes(task.id)).length} tasks left`}>{data.tasks.filter((task) => !data.completedIds.includes(task.id)).length} left</span><button type="button" className="inline-action dashboard-add-action" onClick={() => setAdding((value) => !value)} aria-expanded={adding}><Plus size={15} /> Add task</button></div></div>
    <TaskNotice data={data} />
    <div className="dashboard-data-body">
      {adding && <TaskEditor task={null} date={data.date} disabled={data.saving} onSave={save} onCancel={() => setAdding(false)} />}
      {data.loading ? <p className="task-empty dashboard-empty">Loading your saved tasks…</p> : data.tasks.length === 0 ? !adding && <p className="task-empty dashboard-empty">No tasks for {formatISODate(data.date)} yet.</p> : <TaskRows data={data} />}
    </div>
  </section>
}

export function TasksScreen({ data, onDateChange }: { data: TaskViewData; onDateChange: (date: ISODate) => void }) {
  const [editing, setEditing] = useState<Task | null>(null)
  const [taskFilter, setTaskFilter] = useState<'all' | 'open' | 'completed'>('all')
  const confirm = useLumiConfirm()
  const completedCount = data.tasks.filter((task) => data.completedIds.includes(task.id)).length
  const visibleTasks = data.tasks.filter((task) => taskFilter === 'all' || (taskFilter === 'completed' ? data.completedIds.includes(task.id) : !data.completedIds.includes(task.id)))
  async function create(input: TaskInput) {
    return data.mutate(() => data.createTask(input), 'Task saved successfully.')
  }
  async function save(input: TaskInput) {
    if (editing) return data.mutate(() => data.updateTask(editing.id, input), 'Task updated successfully.')
    return create(input)
  }
  async function remove(task: Task) {
    if (await confirm({ title: 'Delete this task?', description: `“${task.title}” and its dated completion records will be removed from your task list.`, confirmLabel: 'Delete task', destructive: true })) {
      void data.mutate(() => data.deleteTask(task.id), 'Task deleted successfully.')
    }
  }
  return <section className="habits-screen task-screen" aria-labelledby="tasks-title">
    <div className="habits-screen-heading"><div><span className="section-kicker"><Target size={13} /> DAILY PROGRESS</span><h1 id="tasks-title">Tasks</h1><p>Plan a day, then watch your progress build.</p></div>
    </div>
    <label className="date-picker-label" htmlFor="task-date"><CalendarDays size={17} /><span>Tasks for</span><input id="task-date" type="date" value={data.date} disabled={data.saving} onChange={(event) => { if (event.target.value) onDateChange(event.target.value as ISODate) }} /></label>
    <p className="selected-date-copy">{formatISODate(data.date)}</p>
    <TaskNotice data={data} />
    {data.cloudMode && <TaskImportPanel data={data} />}
    <TaskEditor key={`create-${data.date}`} idPrefix="create-task" task={null} date={data.date} disabled={data.saving} onSave={create} onCancel={() => undefined} keepOpenOnSave />
    {editing && <TaskEditor key={editing.id} idPrefix="edit-task" task={editing} date={data.date} disabled={data.saving} onSave={save} onCancel={() => setEditing(null)} />}
    <div className="habit-manager-card glass"><div className="manager-heading"><div><h2>Task list</h2><p>Tasks for this date power both the Daily Orb and Today’s Priorities.</p></div><span className="habit-total">{data.tasks.length}</span></div>
      {!data.loading && !data.error && data.tasks.length > 0 && <div className="task-list-toolbar"><p>{completedCount} of {data.tasks.length} complete</p><div className="task-view-filters" role="group" aria-label="Filter tasks for selected date">{([['all', 'All'], ['open', 'To do'], ['completed', 'Done']] as const).map(([filter, label]) => <button key={filter} type="button" aria-pressed={taskFilter === filter} onClick={() => setTaskFilter(filter)}>{label}</button>)}</div></div>}
      {data.loading ? <p className="task-empty">Loading your saved tasks…</p> : data.error ? <p className="task-empty">Your saved tasks could not be loaded. Retry above.</p> : data.tasks.length === 0 ? <div className="manager-empty"><span className="empty-orbit"><Target size={20} /></span><h3>No tasks yet</h3><p>Add a task to start tracking today’s progress.</p></div> : visibleTasks.length > 0 ? <TaskRows data={{ ...data, tasks: visibleTasks }} editable onEdit={setEditing} onDelete={remove} /> : <p className="task-empty task-filter-empty">{taskFilter === 'completed' ? 'No completed tasks for this date yet.' : 'All tasks for this date are complete.'}</p>}
      <p className="local-data-note">{data.cloudMode ? 'Your tasks and completion history sync with your account. Tasks saved on this device remain separate until you choose to import them.' : 'Your tasks and completion history are saved on this device.'}</p></div>
  </section>
}

function TaskImportPanel({ data }: { data: TaskViewData }) {
  const plan = data.importPlan
  const confirm = useLumiConfirm()
  async function importWithConsent() {
    if (!plan) return
    const accepted = await confirm({
      title: `Add ${plan.addTasks.length} task${plan.addTasks.length === 1 ? '' : 's'}?`,
      description: `${plan.duplicateCount} matching task${plan.duplicateCount === 1 ? ' is' : 's are'} already saved and will stay unchanged. ${plan.conflictCount} conflicting task${plan.conflictCount === 1 ? ' is' : 's are'} excluded. ${plan.unsupportedIdCount} task${plan.unsupportedIdCount === 1 ? ' has' : 's have'} an unsupported ID and can’t be added safely. Your device records will remain unchanged.`,
      confirmLabel: `Add ${plan.addTasks.length} tasks`,
    })
    if (accepted) void data.importTasks()
  }
  return <section className="task-import-panel glass" aria-labelledby="task-import-title">
    <div><h2 id="task-import-title">Add tasks from this device</h2><p>Nothing is added to your account until you approve it. Lumi checks for duplicates and conflicts first.</p></div>
    {data.importError && <p className="account-feedback account-error" role="alert">{data.importError}<button type="button" className="task-import-retry" onClick={() => void data.refreshImportPlan()}>Retry preview</button></p>}
    {data.importLoading || !plan ? <p className="task-import-summary" role="status">Checking for tasks on this device…</p> : <>
      <p className="task-import-summary">{plan.addTasks.length} new task{plan.addTasks.length === 1 ? '' : 's'} ready to add · {plan.localTaskCount} task{plan.localTaskCount === 1 ? '' : 's'} found · {plan.duplicateCount} matching duplicate{plan.duplicateCount === 1 ? '' : 's'} · {plan.conflictCount} conflict{plan.conflictCount === 1 ? '' : 's'} · {plan.unsupportedIdCount} unsupported ID{plan.unsupportedIdCount === 1 ? '' : 's'}</p>
      <button type="button" className="secondary-button" disabled={data.importSaving || plan.addTasks.length === 0} onClick={() => void importWithConsent()}>{data.importSaving ? 'Adding…' : `Review and add ${plan.addTasks.length} task${plan.addTasks.length === 1 ? '' : 's'}`}</button>
    </>}
  </section>
}

function TaskRows({ data, editable = false, onEdit, onDelete }: { data: TaskViewData; editable?: boolean; onEdit?: (task: Task) => void; onDelete?: (task: Task) => void }) {
  return <div className="priority-list task-list">{data.tasks.map((task) => {
    const done = data.completedIds.includes(task.id)
    return <div className={`priority-row ${done ? 'completed' : ''} ${task.icon ? 'has-icon' : ''} ${editable ? 'is-editable' : ''}`} key={task.id}>
      <button type="button" className="check-button" disabled={data.saving} onClick={() => data.onToggle(task, !done)} aria-pressed={done} aria-label={`${done ? 'Mark incomplete' : 'Complete'} ${task.title}`}>
        {done ? <span className="checked"><Check size={16} strokeWidth={2.5} /></span> : <Circle size={21} strokeWidth={1.8} />}
      </button>
      {task.icon && <span className="task-icon" aria-hidden="true"><ActivityIcon value={task.icon} size={17} /></span>}
      <div className="task-copy">
        <span className="priority-title">{task.title}</span>
        {task.time && <time dateTime={task.time}>{formatTaskTime(task.time)}</time>}
      </div>
      {editable && <span className="task-actions"><button type="button" className="habit-action" disabled={data.saving} aria-label={`Edit ${task.title}`} onClick={() => onEdit?.(task)}><Pencil size={15} /></button><button type="button" className="habit-action delete-action" disabled={data.saving} aria-label={`Delete ${task.title}`} onClick={() => onDelete?.(task)}><Trash2 size={15} /></button></span>}
    </div>
  })}</div>
}

function formatTaskTime(value: string): string {
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return value
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, hours, minutes))
}

function TaskEditor({ task, date, disabled, onSave, onCancel, keepOpenOnSave = false, idPrefix = 'task' }: { task: Task | null; date: ISODate; disabled: boolean; onSave: (input: TaskInput) => Promise<boolean>; onCancel: () => void; keepOpenOnSave?: boolean; idPrefix?: string }) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [time, setTime] = useState(task?.time ?? '09:00')
  const [taskDate, setTaskDate] = useState(task?.date ?? date)
  const [icon, setIcon] = useState(task?.icon ?? '')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const iconChange = icon ? { icon } : task?.icon ? { icon: null } : {}
    if (!await onSave({ title, time, date: taskDate, ...iconChange })) return
    if (keepOpenOnSave && !task) { setTitle(''); setTime('09:00'); setTaskDate(date); setIcon('') }
    else onCancel()
  }
  const createSection = keepOpenOnSave && !task
  return <form className={`habit-editor task-editor ${createSection ? 'task-create-section' : ''}`} onSubmit={submit} aria-label={task ? 'Edit task' : 'Create task'}>
    <div className="editor-heading"><h3>{task ? 'Edit task' : createSection ? 'Create Your Task' : 'Create a task'}</h3>{!createSection && <button type="button" className="habit-action" aria-label="Close task form" disabled={disabled} onClick={onCancel}><X size={17} /></button>}</div>
    <label className="field-label" htmlFor={`${idPrefix}-title`}>Task title</label><input id={`${idPrefix}-title`} className="habit-text-input" value={title} maxLength={80} required autoFocus={!createSection} disabled={disabled} placeholder="e.g. Study for two hours" onChange={(event) => setTitle(event.target.value)} />
    <ActivityIconPicker value={icon} onChange={setIcon} options={TASK_ICON_OPTIONS} label="Icon (optional)" noneLabel="None" disabled={disabled} />
    <div className="editor-row task-editor-row"><label className="field-label" htmlFor={`${idPrefix}-time`}>Time<input id={`${idPrefix}-time`} className="habit-select" type="time" value={time} required disabled={disabled} onChange={(event) => setTime(event.target.value)} /></label><label className="field-label" htmlFor={`${idPrefix}-date`}>Date<input id={`${idPrefix}-date`} className="habit-select" type="date" value={taskDate} required disabled={disabled} onChange={(event) => setTaskDate(event.target.value as ISODate)} /></label></div>
    <div className="editor-actions">{!createSection && <button type="button" className="secondary-button" disabled={disabled} onClick={onCancel}>Cancel</button>}<button className="primary-button" disabled={disabled}><Plus size={16} />{disabled ? 'Saving task…' : task ? 'Save changes' : createSection ? 'Create Task' : 'Add task'}</button></div>
  </form>
}

function TaskNotice({ data }: { data: TaskViewData }) {
  if (!data.error && !data.notice) return null
  return <div className={`habit-notice ${data.error ? 'notice-error' : 'notice-success'}`} role={data.error ? 'alert' : 'status'}><span>{data.error ?? data.notice}</span>{data.error && <button onClick={() => void data.reload()}>Retry</button>}</div>
}
