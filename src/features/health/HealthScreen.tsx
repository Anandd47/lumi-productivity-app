import { useEffect, useState, type FormEvent } from 'react'
import { Activity, Check, Droplets, HeartPulse, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import type { ActivityEntry, ActivityType, ISODate, WaterEntry } from '../../domain/types'
import { formatISODate, toISODate } from '../../domain/date'
import { DEFAULT_WATER_GOAL_GLASSES } from './constants'
import { ACTIVITY_TYPES } from './repository'
import { activityMinutes, waterProgress } from './progress'
import type { useHealthData } from './useHealthData'
import { useLumiConfirm } from '../../components/ConfirmDialog'
import './health.css'

type HealthData = ReturnType<typeof useHealthData>
const emptyDate = () => toISODate(new Date())

export function HealthScreen({ data }: { data: HealthData }) {
  const confirm = useLumiConfirm()
  const today = emptyDate()
  const goal = data.settings?.waterGoalGlasses ?? DEFAULT_WATER_GOAL_GLASSES
  const water = waterProgress(data.waterEntries, today, goal)
  const movement = activityMinutes(data.activityEntries, today)
  const [goalValue, setGoalValue] = useState(goal)
  const [waterForm, setWaterForm] = useState(false)
  const [activityForm, setActivityForm] = useState(false)
  const [waterId, setWaterId] = useState<string | null>(null)
  const [activityId, setActivityId] = useState<string | null>(null)
  const [waterDate, setWaterDate] = useState<ISODate>(today)
  const [waterGlasses, setWaterGlasses] = useState(1)
  const [activityDate, setActivityDate] = useState<ISODate>(today)
  const [activityType, setActivityType] = useState<ActivityType>('Walking')
  const [duration, setDuration] = useState(30)

  useEffect(() => setGoalValue(goal), [goal])
  function resetWater() { setWaterForm(false); setWaterId(null); setWaterDate(today); setWaterGlasses(1) }
  function resetActivity() { setActivityForm(false); setActivityId(null); setActivityDate(today); setActivityType('Walking'); setDuration(30) }
  function editWater(entry: WaterEntry) { setWaterId(entry.id); setWaterDate(entry.date); setWaterGlasses(entry.glasses); setWaterForm(true) }
  function editActivity(entry: ActivityEntry) { setActivityId(entry.id); setActivityDate(entry.date); setActivityType(entry.type); setDuration(entry.durationMinutes); setActivityForm(true) }

  async function submitWater(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await data.saveWater({ date: waterDate, glasses: waterGlasses }, waterId ?? undefined)) resetWater()
  }
  async function submitActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await data.saveActivity({ date: activityDate, type: activityType, durationMinutes: duration }, activityId ?? undefined)) resetActivity()
  }
  async function submitGoal(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await data.updateWaterGoal(goalValue) }

  async function confirmRemove(label: string, remove: () => Promise<boolean>) {
    if (await confirm({ title: `Delete this ${label}?`, description: `This saved ${label} will be permanently removed.`, confirmLabel: `Delete ${label}`, destructive: true })) void remove()
  }

  return <section className="health-screen" aria-labelledby="health-title">
    <header className="health-page-heading"><div><span className="section-kicker"><HeartPulse size={13} /> WELLNESS</span><h1 id="health-title">Health tracking</h1><p>Track water and movement with your own daily entries.</p></div></header>
    {data.error && <p className="health-feedback health-error" role="alert">{data.error}<button type="button" onClick={() => void data.reload()}>Retry</button></p>}
    {data.notice && <p className="health-feedback" role="status"><Check size={14} />{data.notice}</p>}

    <div className="health-today-grid">
      <article className="health-stat-card water-stat glass"><div className="health-stat-top"><span className="health-stat-icon"><Droplets size={19} /></span><span>WATER · TODAY</span></div><strong>{water.glasses}<small> / {goal} glasses</small></strong><div className="health-goal-track" role="progressbar" aria-label="Water goal progress" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(water.glasses, goal)}><i style={{ width: `${water.percent}%` }} /></div><span className="health-stat-note">{water.percent}% of your daily goal</span></article>
      <article className="health-stat-card activity-stat glass"><div className="health-stat-top"><span className="health-stat-icon"><Activity size={19} /></span><span>ACTIVITY · TODAY</span></div><strong>{movement}<small> minutes</small></strong><span className="health-stat-note">{movement ? 'Movement logged today' : 'No activity logged today'}</span></article>
    </div>

    <section className="health-panel glass" aria-labelledby="water-heading">
      <div className="health-panel-heading"><div><h2 id="water-heading"><Droplets size={17} /> Water intake</h2><p>Log glasses of water. Entries add toward today’s goal.</p></div><button type="button" className="primary-button health-add-button" onClick={() => waterForm ? resetWater() : setWaterForm(true)} aria-expanded={waterForm}>{waterForm ? <X size={15} /> : <Plus size={15} />}{waterForm ? 'Close' : 'Log water'}</button></div>
      <form className="health-goal-row" onSubmit={submitGoal}><label htmlFor="water-goal">Daily goal · glasses</label><input id="water-goal" type="number" min={1} max={30} step={1} required value={goalValue} disabled={data.saving} onChange={(event) => setGoalValue(Number(event.target.value))} /><button type="submit" className="secondary-button" disabled={data.saving}><Save size={14} /> Save goal</button><span>Default: 8 glasses</span></form>
      {waterForm && <form className="health-entry-form" onSubmit={submitWater} aria-label={waterId ? 'Edit water entry' : 'Log water intake'}><label>Date<input type="date" required value={waterDate} disabled={data.saving} onChange={(event) => setWaterDate(event.target.value as ISODate)} /></label><label>Glasses<input type="number" min={1} max={100} step={1} required value={waterGlasses} disabled={data.saving} onChange={(event) => setWaterGlasses(Number(event.target.value))} /></label><div className="health-form-actions"><button type="button" className="secondary-button" onClick={resetWater}>Cancel</button><button type="submit" className="primary-button" disabled={data.saving}><Check size={15} />{waterId ? 'Save changes' : 'Save water'}</button></div></form>}
      <div className="health-history-heading"><h3>Water history</h3><span>{data.waterEntries.length} {data.waterEntries.length === 1 ? 'entry' : 'entries'}</span></div>
      {data.loading ? <p className="health-empty">Loading water history…</p> : data.waterEntries.length === 0 ? <p className="health-empty">No water entries yet. Log your first glass when you’re ready.</p> : <div className="health-entry-list">{data.waterEntries.map((entry) => <article className="health-entry-row" key={entry.id}><span className="health-row-icon water-row-icon"><Droplets size={15} /></span><div><strong>{formatISODate(entry.date)}</strong><span>{entry.glasses} {entry.glasses === 1 ? 'glass' : 'glasses'}</span></div><strong className="health-entry-value">{entry.glasses} <small>gl</small></strong><EntryActions label={`water entry on ${formatISODate(entry.date)}`} onEdit={() => editWater(entry)} onDelete={() => confirmRemove('water entry', () => data.removeWater(entry.id))} disabled={data.saving} /></article>)}</div>}
    </section>

    <section className="health-panel glass" aria-labelledby="activity-heading">
      <div className="health-panel-heading"><div><h2 id="activity-heading"><Activity size={17} /> Physical activity</h2><p>Record activity type, duration, and date.</p></div><button type="button" className="primary-button health-add-button" onClick={() => activityForm ? resetActivity() : setActivityForm(true)} aria-expanded={activityForm}>{activityForm ? <X size={15} /> : <Plus size={15} />}{activityForm ? 'Close' : 'Log activity'}</button></div>
      {activityForm && <form className="health-entry-form activity-form" onSubmit={submitActivity} aria-label={activityId ? 'Edit activity entry' : 'Log physical activity'}><label>Activity<select value={activityType} disabled={data.saving} onChange={(event) => setActivityType(event.target.value as ActivityType)}>{ACTIVITY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label>Duration · minutes<input type="number" min={1} max={1440} step={1} required value={duration} disabled={data.saving} onChange={(event) => setDuration(Number(event.target.value))} /></label><label>Date<input type="date" required value={activityDate} disabled={data.saving} onChange={(event) => setActivityDate(event.target.value as ISODate)} /></label><div className="health-form-actions"><button type="button" className="secondary-button" onClick={resetActivity}>Cancel</button><button type="submit" className="primary-button" disabled={data.saving}><Check size={15} />{activityId ? 'Save changes' : 'Save activity'}</button></div></form>}
      <div className="health-history-heading"><h3>Recent activity</h3><span>{data.activityEntries.length} {data.activityEntries.length === 1 ? 'entry' : 'entries'}</span></div>
      {data.loading ? <p className="health-empty">Loading activity history…</p> : data.activityEntries.length === 0 ? <p className="health-empty">No activity logged yet. Add a movement entry to start your history.</p> : <div className="health-entry-list">{data.activityEntries.map((entry) => <article className="health-entry-row" key={entry.id}><span className="health-row-icon activity-row-icon"><Activity size={15} /></span><div><strong>{formatISODate(entry.date)}</strong><span>{entry.type}</span></div><strong className="health-entry-value">{entry.durationMinutes} <small>min</small></strong><EntryActions label={`${entry.type} entry on ${formatISODate(entry.date)}`} onEdit={() => editActivity(entry)} onDelete={() => confirmRemove('activity entry', () => data.removeActivity(entry.id))} disabled={data.saving} /></article>)}</div>}
    </section>
  </section>
}

function EntryActions({ label, onEdit, onDelete, disabled }: { label: string; onEdit: () => void; onDelete: () => void; disabled: boolean }) {
  return <div className="health-entry-actions"><button type="button" className="sleep-row-action" disabled={disabled} aria-label={`Edit ${label}`} onClick={onEdit}><Pencil size={14} /></button><button type="button" className="sleep-row-action delete-action" disabled={disabled} aria-label={`Delete ${label}`} onClick={onDelete}><Trash2 size={14} /></button></div>
}
