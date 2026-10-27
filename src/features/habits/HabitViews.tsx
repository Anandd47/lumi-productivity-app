import { useState } from 'react'
import { CalendarDays, Plus, Sparkles } from 'lucide-react'
import type { Habit, ISODate } from '../../domain/types'
import { dateFromISO, formatISODate, toISODate } from '../../domain/date'
import { useLumiConfirm } from '../../components/ConfirmDialog'
import { createHabit, deleteHabit, updateHabit, type HabitInput } from './repository'
import { HabitEditor, HabitNotice, HabitRows } from './HabitComponents'
import './habits.css'

type HabitData = {
  habits: Habit[]
  completedIds: string[]
  weekLogs: { date: ISODate; completedHabitIds: string[] }[]
  date: ISODate
  loading: boolean
  saving: boolean
  error: string | null
  notice: string | null
  mutate: (operation: () => Promise<unknown>, successMessage: string) => Promise<boolean>
  reload: () => Promise<void>
  onToggle: (habit: Habit, completed: boolean) => void
}

export function HabitDashboardCard({ data }: { data: HabitData }) {
  const [adding, setAdding] = useState(false)
  const activeHabits = data.habits.filter((habit) => habit.createdAt <= data.date && (!habit.archivedAt || data.date < habit.archivedAt))
  const completedCount = activeHabits.filter((habit) => data.completedIds.includes(habit.id)).length
  const isToday = data.date === toISODate(new Date())
  async function save(input: HabitInput) {
    return data.mutate(() => createHabit(input), 'Habit created and saved on this device.')
  }
  return <section className="habits-card glass" aria-labelledby="today-habits-title">
    <div className="habits-card-heading dashboard-data-header">
      <div className="dashboard-data-title"><span className="dashboard-data-icon habit-title-icon"><Sparkles size={19} /></span><h2 id="today-habits-title">{isToday ? 'Today’s Habits' : 'Habits for this day'}</h2></div>
      <div className="dashboard-data-actions"><span className="habit-count" aria-label={activeHabits.length ? `${completedCount} of ${activeHabits.length} habits done` : '0 habits'}>{activeHabits.length ? `${completedCount}/${activeHabits.length} done` : '0 habits'}</span><button className="inline-action dashboard-add-action" type="button" onClick={() => setAdding((value) => !value)} aria-expanded={adding}><Plus size={15} /> Add habit</button></div>
    </div>
    <HabitNotice error={data.error} notice={data.notice} onRetry={() => void data.reload()} />
    <div className="dashboard-data-body">
      {adding && <HabitEditor habit={null} disabled={data.saving} onSave={save} onCancel={() => setAdding(false)} />}
      {data.loading ? <p className="habits-empty dashboard-empty">Loading your habits…</p> : data.error ? <p className="habits-empty dashboard-empty">Your saved habits could not be loaded. Retry above.</p> : activeHabits.length === 0 && !adding ? <div className="habits-empty dashboard-empty">
        <span>{data.habits.length === 0 ? 'Your daily rhythm starts with one small habit.' : 'No habits are active on this date.'}</span>
      </div> : activeHabits.length > 0 ? <HabitRows habits={activeHabits} date={data.date} completedIds={data.completedIds} disabled={data.saving} onToggle={data.onToggle} /> : null}
    </div>
  </section>
}

export function HabitsScreen({ data, onDateChange }: { data: HabitData; onDateChange: (date: ISODate) => void }) {
  const [editing, setEditing] = useState<Habit | null>(null)
  const [adding, setAdding] = useState(false)
  const confirm = useLumiConfirm()
  const completedIds = data.completedIds
  const activeHabits = data.habits.filter((habit) => habit.createdAt <= data.date && (!habit.archivedAt || data.date < habit.archivedAt))
  const completedCount = activeHabits.filter((habit) => completedIds.includes(habit.id)).length

  async function save(input: HabitInput) {
    if (editing) return data.mutate(() => updateHabit(editing.id, input), 'Habit updated and saved on this device.')
    return data.mutate(() => createHabit(input), 'Habit created and saved on this device.')
  }

  async function requestDelete(habit: Habit) {
    const approved = await confirm({ title: 'Delete this habit?', description: `“${habit.name}” and its dated completion history will be removed from your routines.`, confirmLabel: 'Delete habit', destructive: true })
    if (approved) void data.mutate(() => deleteHabit(habit.id), 'Habit and its completion records deleted.')
  }

  return <section className="habits-screen" aria-labelledby="habits-screen-title">
    <div className="habits-screen-heading">
      <div><span className="section-kicker"><Sparkles size={13} /> BUILD YOUR RHYTHM</span><h1 id="habits-screen-title">Habits</h1><p>Small promises, kept one day at a time.</p></div>
      {!adding && !editing && data.habits.length > 0 && <button className="primary-button add-habit-button" type="button" onClick={() => setAdding(true)}><Plus size={17} /> Add habit</button>}
    </div>

    <label className="date-picker-label" htmlFor="habit-date"><CalendarDays size={17} /><span>Completions for</span>
      <input id="habit-date" type="date" value={data.date} disabled={data.saving} onChange={(event) => { if (event.target.value) onDateChange(event.target.value as ISODate) }} />
    </label>
    <p className="selected-date-copy">{formatISODate(data.date)}</p>
    <div className="habit-progress-summary" role="status">{data.loading ? 'Loading habit progress…' : data.error ? 'Habit progress unavailable' : `${completedCount} of ${activeHabits.length} complete`}</div>
    <section className="habit-week-history" aria-label="Habit check-ins for the selected week">
      <div className="habit-week-heading"><h2>Weekly check-ins</h2><span>Selected week</span></div>
      {data.loading ? <p className="habit-week-empty">Loading saved check-ins…</p> : data.error ? <p className="habit-week-empty">Weekly history is unavailable. Retry to check saved records.</p> : <div className="habit-week-strip">{data.weekLogs.map((log) => {
        const active = data.habits.filter((habit) => habit.createdAt <= log.date && (!habit.archivedAt || log.date < habit.archivedAt))
        const done = active.filter((habit) => log.completedHabitIds.includes(habit.id)).length
        const future = log.date > toISODate(new Date())
        const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(dateFromISO(log.date))
        return <div key={log.date} className={`habit-week-day ${future ? 'future' : done ? 'has-checkin' : 'no-checkin'}`} role="img" aria-label={`${formatISODate(log.date)}: ${future ? 'not yet due' : `${done} habit check-ins`}`} title={`${weekday} · ${done} check-ins`}><span>{weekday}</span><strong>{future ? '·' : done}</strong></div>
      })}</div>}
    </section>

    <HabitNotice error={data.error} notice={data.notice} onRetry={() => void data.reload()} />
    {(adding || editing) && <HabitEditor key={editing?.id ?? 'new-habit'} habit={editing} disabled={data.saving} onSave={save} onCancel={() => { setAdding(false); setEditing(null) }} />}

    <div className="habit-manager-card glass">
      <div className="manager-heading"><div><h2>Habit list</h2><p>Recurring habits have their own daily completion history, separate from tasks.</p></div><span className="habit-total">{data.habits.length}</span></div>
      {data.loading ? <p className="habits-empty">Loading your habits…</p> : data.error ? <p className="habits-empty">Your saved habits could not be loaded. Retry above.</p> : data.habits.length === 0 ? <div className="manager-empty"><span className="empty-orbit"><Sparkles size={20} /></span><h3>No habits yet</h3><p>Add a recurring routine to start building your daily rhythm.</p>{!adding && <button type="button" className="primary-button" onClick={() => setAdding(true)}><Plus size={16} /> Create your first habit</button>}</div> : <HabitRows
        habits={data.habits}
        date={data.date}
        completedIds={completedIds}
        editable
        disabled={data.saving}
        onToggle={data.onToggle}
        onEdit={(habit) => { setAdding(false); setEditing(habit) }}
        onDelete={requestDelete}
      />}
      <p className="local-data-note">Your habits and daily completions are saved on this device.</p>
    </div>
    <p className="core-optional-note"><span className="kind-dot core-dot" /> Core routine <span className="kind-dot optional-dot" /> Optional routine</p>
  </section>
}

