import { useEffect, useState, type FormEvent } from 'react'
import { AlarmClock, CalendarDays, Check, Clock3, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import type { ISODate, SleepRecord } from '../../domain/types'
import { formatISODate, toISODate } from '../../domain/date'
import { formatDuration } from '../focus/progress'
import { useLumiConfirm } from '../../components/ConfirmDialog'
import { calculateSleepProgress, summarizeSleepWeek } from './progress'
import { DEFAULT_SLEEP_TARGET_MINUTES } from './constants'
import type { useSleepData } from './useSleepData'
import './sleep.css'

type SleepData = ReturnType<typeof useSleepData>

export function SleepTracker({ data }: { data: SleepData }) {
  const confirm = useLumiConfirm()
  const today = toISODate(new Date())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState<ISODate>(today)
  const [startTime, setStartTime] = useState('')
  const [wakeTime, setWakeTime] = useState('')
  const [goalHours, setGoalHours] = useState(8)
  const settingsGoal = data.settings?.sleepTargetMinutes ?? DEFAULT_SLEEP_TARGET_MINUTES
  const week = summarizeSleepWeek(data.records, today, settingsGoal)

  useEffect(() => { setGoalHours(settingsGoal / 60) }, [settingsGoal])

  function resetForm() {
    setEditingId(null)
    setDate(today)
    setStartTime('')
    setWakeTime('')
    setShowForm(false)
  }

  function editRecord(record: SleepRecord) {
    setEditingId(record.id)
    setDate(record.date)
    setStartTime(record.startTime)
    setWakeTime(record.wakeTime)
    setShowForm(true)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await data.saveRecord({ date, startTime, wakeTime }, editingId ?? undefined)) resetForm()
  }

  async function updateGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await data.updateGoal(Math.round(goalHours * 60))
  }

  async function requestDelete(record: SleepRecord) {
    if (await confirm({ title: 'Delete this sleep record?', description: `${formatDuration(record.durationMinutes * 60)} logged for ${formatISODate(record.date)} will be removed from your sleep history.`, confirmLabel: 'Delete record', destructive: true })) void data.removeRecord(record.id)
  }

  return <section className="sleep-tracker-card glass" aria-labelledby="sleep-tracker-title">
    <div className="sleep-tracker-heading"><div><span className="section-kicker"><AlarmClock size={13} /> REST & RECOVERY</span><h2 id="sleep-tracker-title">Sleep tracking</h2><p>Log the night by the local date you woke up.</p></div><button className="primary-button sleep-add-button" type="button" onClick={() => showForm ? resetForm() : setShowForm(true)} aria-expanded={showForm}>{showForm ? <X size={15} /> : <Plus size={15} />}{showForm ? 'Close' : 'Log sleep'}</button></div>

    {data.error && <p className="sleep-feedback sleep-error" role="alert">{data.error}<button type="button" onClick={() => void data.reload()}>Retry</button></p>}
    {data.notice && <p className="sleep-feedback" role="status"><Check size={14} />{data.notice}</p>}

    <div className="sleep-week-summary" aria-label="Sleep summary for this week">
      <article><span>This week</span><strong>{formatDuration(week.totalMinutes * 60)}</strong></article>
      <article><span>Average per logged night</span><strong>{formatDuration(week.averageMinutes * 60)}</strong></article>
      <article><span>Goal reached</span><strong>{week.goalMetNights} / {week.loggedNights} nights</strong></article>
    </div>

    <div className="sleep-settings-row"><div><strong>Daily sleep goal</strong><span>{formatDuration(settingsGoal * 60)}</span></div><form className="sleep-goal-form" onSubmit={updateGoal}><label htmlFor="sleep-goal-hours">Goal · hours</label><input id="sleep-goal-hours" type="number" min={1} max={24} step={0.5} required value={goalHours} disabled={data.saving} onChange={(event) => setGoalHours(Number(event.target.value))} /><button type="submit" className="secondary-button" disabled={data.saving}><Save size={14} /> Save goal</button></form></div>

    {showForm && <form className="sleep-editor" onSubmit={submit} aria-label={editingId ? 'Edit sleep record' : 'Log sleep'}>
      <div className="sleep-editor-heading"><h3>{editingId ? 'Edit sleep record' : 'Log a night of sleep'}</h3><p>For overnight sleep, enter the date you woke up. A start time later than wake-up is treated as the previous evening.</p></div>
      <div className="sleep-fields">
        <label htmlFor="sleep-wake-date"><CalendarDays size={15} /> Wake-up date<input id="sleep-wake-date" type="date" required value={date} disabled={data.saving} onChange={(event) => setDate(event.target.value as ISODate)} /></label>
        <label htmlFor="sleep-start-time"><Clock3 size={15} /> Sleep start<input id="sleep-start-time" type="time" required value={startTime} disabled={data.saving} onChange={(event) => setStartTime(event.target.value)} /></label>
        <label htmlFor="sleep-wake-time"><AlarmClock size={15} /> Wake-up time<input id="sleep-wake-time" type="time" required value={wakeTime} disabled={data.saving} onChange={(event) => setWakeTime(event.target.value)} /></label>
      </div>
      <div className="sleep-editor-actions"><button type="button" className="secondary-button" disabled={data.saving} onClick={resetForm}>Cancel</button><button type="submit" className="primary-button" disabled={data.saving}><Check size={15} />{data.saving ? 'Saving…' : editingId ? 'Save changes' : 'Save sleep'}</button></div>
    </form>}

    <div className="sleep-history"><div className="sleep-history-heading"><h3>Sleep history</h3><span>{data.records.length} {data.records.length === 1 ? 'record' : 'records'}</span></div>
      {data.loading ? <p className="sleep-history-empty">Loading saved sleep records…</p> : data.records.length === 0 ? <p className="sleep-history-empty">No sleep records yet. Log a sleep period to start your history.</p> : <div className="sleep-history-list">{data.records.map((record) => {
        const progress = calculateSleepProgress(record, settingsGoal)
        return <article className="sleep-history-row" key={record.id}>
          <span className="sleep-history-icon"><AlarmClock size={16} /></span>
          <div className="sleep-history-copy"><strong>{formatISODate(record.date)}</strong><span>{record.startTime} → {record.wakeTime} · {record.startTime > record.wakeTime ? 'overnight' : 'same day'}</span><div className="sleep-progress-track" aria-label={`${progress.percent}% of sleep goal`}><i style={{ width: `${progress.percent}%` }} /></div></div>
          <strong className="sleep-history-duration">{formatDuration(record.durationMinutes * 60)}</strong>
          <div className="sleep-history-actions"><button type="button" className="sleep-row-action" disabled={data.saving} aria-label={`Edit sleep record for ${formatISODate(record.date)}`} onClick={() => editRecord(record)}><Pencil size={14} /></button><button type="button" className="sleep-row-action delete-action" disabled={data.saving} aria-label={`Delete sleep record for ${formatISODate(record.date)}`} onClick={() => requestDelete(record)}><Trash2 size={14} /></button></div>
        </article>
      })}</div>}
    </div>
  </section>
}
