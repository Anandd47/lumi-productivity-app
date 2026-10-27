import { useMemo, useState, type FormEvent } from 'react'
import { Check, ShieldCheck, Sparkles, Trophy } from 'lucide-react'
import { dateFromISO, formatISODate, previousLocalDate } from '../../domain/date'
import type { ISODate } from '../../domain/types'
import { CosmicFlameMark } from '../../components/CosmicFlameMark'
import type { useStreakData } from './useStreakData'
import { buildStreakMonth, type StreakDayState } from './history'
import { useLumiConfirm } from '../../components/ConfirmDialog'

type StreakData = ReturnType<typeof useStreakData>

export function StreakScreen({ data, milestoneAnimation, onManageHabits }: { data: StreakData; milestoneAnimation: boolean; onManageHabits: () => void }) {
  const confirm = useLumiConfirm()
  const today = data.stats.today
  const [graceDate, setGraceDate] = useState<ISODate>(() => previousLocalDate(today))
  const activeCoreHabits = data.habits.filter((habit) => habit.kind === 'core' && habit.createdAt <= today && (!habit.archivedAt || today < habit.archivedAt))
  const graceAvailable = !data.stats.currentMonthGrace
  const hasPassedDateThisMonth = previousLocalDate(today).slice(0, 7) === today.slice(0, 7)
  const historyUnavailable = data.loading || Boolean(data.error)
  const calendarDays = useMemo(() => buildStreakMonth(today, data.stats.qualifyingDates, data.graceDays.filter((day) => day.month === today.slice(0, 7)).map((day) => day.usedOn), data.habits), [today, data.stats.qualifyingDates, data.graceDays, data.habits])
  const calendarWeeks = useMemo(() => Array.from({ length: calendarDays.length / 7 }, (_, index) => calendarDays.slice(index * 7, index * 7 + 7)), [calendarDays])
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(dateFromISO(today))

  async function submitGrace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const accepted = await confirm({
      title: 'Use this month’s grace day?',
      description: `Apply your one grace day to ${formatISODate(graceDate)}? This protects an existing streak but does not count as a qualifying day.`,
      confirmLabel: 'Use grace day',
    })
    if (accepted) await data.applyGrace(graceDate)
  }

  async function undoGrace() {
    const accepted = await confirm({ title: 'Undo this grace day?', description: 'Your streak will be recalculated, and this month’s grace day will become available again.', confirmLabel: 'Undo grace day' })
    if (accepted && data.stats.currentMonthGrace) void data.undoGrace(data.stats.currentMonthGrace.month)
  }

  const stateLabel: Record<StreakDayState, string> = { outside: 'Outside this month', completed: 'Qualifying day', grace: 'Grace day used', missed: 'Missed qualifying day', today: 'Today · in progress', future: 'Future day', untracked: 'Not tracked · fewer than 2 core habits active' }

  return <section className="streak-screen" aria-labelledby="streak-title">
    <header className="streak-page-heading"><div><h1 id="streak-title">Your streak</h1></div></header>
    {data.error && <p className="streak-feedback streak-error" role="alert">{data.error}<button type="button" onClick={() => void data.reload()}>Retry</button></p>}
    {data.notice && <p className="streak-feedback" role="status"><Check size={14} />{data.notice}</p>}

    {!historyUnavailable && !data.stats.configured && <div className="streak-config-warning" role="note"><Sparkles size={17} /><div><strong>Choose at least 2 core habits</strong><p>Only completed core habits count toward your streak.</p><button type="button" className="streak-manage-link" onClick={onManageHabits}>Manage habits</button></div></div>}

    <section className="streak-current-summary" aria-label="Current streak summary">
      <span className="streak-current-icon"><CosmicFlameMark days={data.stats.currentStreak} size={32} animate={milestoneAnimation} /></span>
      <div><span className="streak-summary-label">Current streak</span><strong>{historyUnavailable ? '—' : `${data.stats.currentStreak} days`}</strong></div>
    </section>

    <div className="streak-stat-grid" aria-label="Streak statistics">
      <article className="streak-stat-card"><span>Longest streak</span><strong>{historyUnavailable ? '—' : `${data.stats.longestStreak} days`}</strong></article>
      <article className="streak-stat-card"><span>This month</span><strong>{historyUnavailable ? '—' : `${data.stats.currentMonthQualifyingDays} days`}</strong></article>
    </div>

    <section className="streak-panel grace-panel" aria-labelledby="grace-title">
      <div className="streak-panel-heading"><div><h2 id="grace-title">Monthly grace day</h2><p>Protect one already-passed missed day. It preserves a streak but does not add a qualifying day.</p></div></div>
      {historyUnavailable ? <p className="grace-no-date">Grace day controls are unavailable until your local history loads.</p> : data.stats.currentMonthGrace ? <div className="grace-used-row"><span><ShieldCheck size={17} /> Used for {formatISODate(data.stats.currentMonthGrace.usedOn)}</span><button type="button" className="streak-secondary-action" disabled={data.saving} onClick={() => void undoGrace()}>Undo grace day</button></div> : hasPassedDateThisMonth ? <form className="grace-form" onSubmit={submitGrace}><label htmlFor="grace-date">Missed date<input id="grace-date" type="date" required min={`${today.slice(0, 7)}-01`} max={previousLocalDate(today)} value={graceDate.slice(0, 7) === today.slice(0, 7) ? graceDate : `${today.slice(0, 7)}-01` as ISODate} disabled={data.saving || !graceAvailable} onChange={(event) => { if (event.target.value) setGraceDate(event.target.value as ISODate) }} /></label><button type="submit" className="primary-button" disabled={data.loading || data.saving || !graceAvailable}><ShieldCheck size={15} />{data.saving ? 'Saving…' : 'Use grace day'}</button><span>Available this month · one use; unused days do not roll over.</span></form> : <p className="grace-no-date">Grace day available this month. No date has passed yet; unused days do not roll over.</p>}
    </section>

    <section className="streak-panel streak-history-panel" aria-labelledby="streak-history-title">
      <div className="streak-panel-heading"><div><h2 id="streak-history-title">Habit history</h2><p>{monthLabel} · qualifying days from saved core-habit completions</p></div></div>
      {historyUnavailable ? <p className="grace-no-date">History is unavailable until your saved records load.</p> : <>
        <div className="streak-calendar" role="grid" aria-label={`Habit completion calendar for ${monthLabel}`}>
          <div className="streak-calendar-row" role="row">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day} className="streak-calendar-weekday" role="columnheader">{day}</span>)}</div>
          {calendarWeeks.map((week, index) => <div className="streak-calendar-row" role="row" key={`week-${index}`}>{week.map(({ date, day, state }) => <span key={date} className={`streak-calendar-day ${state} ${date === today ? 'current-date' : ''}`} role="gridcell" aria-label={`${formatISODate(date)}: ${stateLabel[state]}`} title={`${formatISODate(date)} · ${stateLabel[state]}`} aria-current={date === today ? 'date' : undefined}>{state === 'outside' ? '' : day}</span>)}</div>)}
        </div>
        <div className="streak-calendar-legend" aria-label="Calendar legend">
          <span><i className="completed" />Qualifying</span><span><i className="missed" />Missed</span><span><i className="grace" />Grace used</span><span><i className="today" />Today</span><span><i className="future" />Upcoming</span><span><i className="untracked" />Not tracked</span>
        </div>
      </>}
    </section>

    {!historyUnavailable && data.stats.milestoneMessage && <p className="streak-milestone-notice"><Trophy size={15} />{data.stats.milestoneMessage}</p>}

    <section className="streak-panel streak-milestones-panel" aria-labelledby="milestone-title">
      <div className="streak-panel-heading"><div><h2 id="milestone-title">Milestones</h2><p>{historyUnavailable ? 'History unavailable.' : data.stats.nextMilestone ? `${Math.max(0, data.stats.nextMilestone - data.stats.currentStreak)} qualifying days to ${data.stats.nextMilestone}.` : 'All milestones reached.'}</p></div></div>
      <div className="streak-milestones">{[7, 14, 30, 100].map((milestone) => {
        const reached = !historyUnavailable && data.stats.reachedMilestones.includes(milestone as 7 | 14 | 30 | 100)
        return <div key={milestone} className={`streak-milestone ${reached ? 'reached' : ''}`}><span>{reached ? <Check size={15} /> : <Sparkles size={15} />}</span><strong>{milestone}</strong><small>days</small>{reached && <em>Reached</em>}</div>
      })}</div>
    </section>

    <details className="streak-rules-details"><summary>How streaks are counted</summary><p>A day qualifies when at least 2 active core habits are complete. Grace days bridge one missed date but do not add a qualifying day. Today remains in progress until it qualifies.</p><div className="streak-core-list"><div className="streak-core-heading"><strong>Core habits</strong><span>{activeCoreHabits.length} selected</span></div>{activeCoreHabits.length ? activeCoreHabits.map((habit) => <div className="streak-core-item" key={habit.id}><span className="kind-dot core-dot" />{habit.name}</div>) : <p>No core habits selected.</p>}</div></details>
  </section>
}
