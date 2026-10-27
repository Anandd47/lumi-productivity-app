import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, Clock3, Flame, Target } from 'lucide-react'
import type { FocusSession, ISODate } from '../../domain/types'
import { dateFromISO, formatISODate, toISODate } from '../../domain/date'
import { formatDuration } from '../focus/progress'
import { activityOnDate, buildStudyHeatmap, getMonthGrid, monthStart, shiftISODateMonth, shiftMonth, studyIntensity } from './calendar'
import { calculateStudyAnalytics } from './analytics'
import { getSelectedDayData, type InsightsData } from './repository'
import './insights.css'

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const shortMonthFormatter = new Intl.DateTimeFormat(undefined, { month: 'short' })

export function InsightsScreen({ data, loading, error, onRetry, selectedDate, onDateChange }: {
  data: InsightsData | null
  loading: boolean
  error: string | null
  onRetry: () => void
  selectedDate: ISODate
  onDateChange: (date: ISODate) => void
}) {
  const selected = dateFromISO(selectedDate)
  const [viewMonth, setViewMonth] = useState(() => monthStart(selected))
  useEffect(() => setViewMonth(monthStart(dateFromISO(selectedDate))), [selectedDate])
  const today = toISODate(new Date())
  const monthGrid = useMemo(() => getMonthGrid(viewMonth), [viewMonth.getFullYear(), viewMonth.getMonth()])
  const sessions = data?.sessions ?? []
  const analytics = data ? calculateStudyAnalytics(sessions, selectedDate, data.settings.studyTargetSeconds) : null
  const selectedDay = data ? getSelectedDayData(data, selectedDate) : null
  const studyDaySet = new Set(sessions.map((session) => session.date))
  const taskDaySet = new Set((data?.tasks ?? []).map((task) => task.date))
  const completedDaySet = new Set((data?.dailyLogs ?? []).filter((log) => (log.completedTaskIds?.length ?? 0) > 0 || (log.completedHabitIds?.length ?? 0) > 0).map((log) => log.date))
  const activity = { studyDates: studyDaySet, taskDates: taskDaySet, completedDates: completedDaySet }
  const heatmap = useMemo(() => buildStudyHeatmap(sessions), [sessions])
  const heatWeeks = Array.from({ length: heatmap.dates.length / 7 }, (_, week) => heatmap.dates.slice(week * 7, week * 7 + 7))
  const monthLabelColumns = new Map<number, string>()
  heatWeeks.forEach((week, index) => {
    const monthStartDay = week.find((date) => { const key = toISODate(date); return date.getDate() === 1 && key >= heatmap.start && key <= heatmap.end })
    if (monthStartDay) monthLabelColumns.set(index, shortMonthFormatter.format(monthStartDay))
  })

  function chooseMonth(amount: number) {
    const next = shiftMonth(viewMonth, amount)
    setViewMonth(next)
    onDateChange(shiftISODateMonth(selectedDate, amount))
  }

  function chooseToday() {
    onDateChange(today)
    setViewMonth(monthStart(dateFromISO(today)))
  }

  return <section className="insights-screen" aria-labelledby="insights-title">
    <div className="insights-heading"><div><span className="section-kicker"><Activity size={13} /> YOUR HISTORY</span><h1 id="insights-title">Insights</h1><p>Study, tasks, and habits from your saved history.</p></div><button className="insights-today-button" type="button" onClick={chooseToday}><CalendarDays size={15} /> Today</button></div>
    {error && <div className="insights-message insights-error" role="alert">{error}<button type="button" onClick={onRetry}>Retry</button></div>}
    {loading && !data ? <p className="insights-loading" role="status">Loading your saved history…</p> : data && <>
      {analytics && <section className="analytics-overview glass" aria-label="Study analytics">
        <div className="analytics-heading"><div><span className="section-kicker"><BookOpen size={13} /> FOCUSED STUDY</span><h2>Study analytics</h2></div><span className="analytics-period">{monthFormatter.format(selected)}</span></div>
        <div className="analytics-metrics">
          <article><span className="analytics-icon violet"><Clock3 size={17} /></span><strong>{formatDuration(analytics.weekSeconds)}</strong><small>This week</small></article>
          <article><span className="analytics-icon blue"><CalendarDays size={17} /></span><strong>{formatDuration(analytics.monthSeconds)}</strong><small>This month</small></article>
          <article><span className="analytics-icon orange"><Activity size={17} /></span><strong>{formatDuration(analytics.dailyAverageSeconds)}</strong><small>Daily avg · week to date</small></article>
          <article><span className="analytics-icon violet"><Check size={17} /></span><strong>{analytics.weekSessionCount}</strong><small>Saved focus sessions · week</small></article>
          <article><span className="analytics-icon orange"><Target size={17} /></span><strong>{analytics.selectedDateTargetPercent}%</strong><small>Selected day target</small></article>
        </div>
        <div className="analytics-target-note">Daily target: {formatDuration(data.settings.studyTargetSeconds)} · {formatDuration(analytics.selectedDateSeconds)} focused on {selectedDate === today ? 'today' : formatISODate(selectedDate)}</div>
        <div className="analytics-subjects"><h3>Subjects this month</h3>{analytics.subjects.length ? analytics.subjects.map(({ subject, seconds }) => <div className="analytics-subject-row" key={subject}><span>{subject}</span><strong>{formatDuration(seconds)}</strong></div>) : <p>No saved study time in this month.</p>}</div>
      </section>}

      <section className="calendar-card glass" aria-labelledby="monthly-calendar-title">
        <div className="calendar-heading"><div><span className="section-kicker"><CalendarDays size={13} /> DAILY ACTIVITY</span><h2 id="monthly-calendar-title">Monthly calendar</h2></div><div className="calendar-controls"><button type="button" className="calendar-arrow" aria-label="Previous month" onClick={() => chooseMonth(-1)}><ArrowLeft size={17} /></button><strong aria-live="polite">{monthFormatter.format(viewMonth)}</strong><button type="button" className="calendar-arrow" aria-label="Next month" onClick={() => chooseMonth(1)}><ArrowRight size={17} /></button></div></div>
        <div className="month-weekdays" aria-hidden="true">{weekdayLabels.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="month-grid" aria-labelledby="monthly-calendar-title">
          {monthGrid.map((date) => {
            const key = toISODate(date)
            const inMonth = date.getMonth() === viewMonth.getMonth()
            const isSelected = key === selectedDate
            const hasActivity = activityOnDate(activity, key)
            return <button type="button" key={key} className={`month-day ${inMonth ? '' : 'outside-month'} ${key === today ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${hasActivity ? 'has-activity' : ''}`} aria-label={`${formatISODate(key)}${hasActivity ? ', activity recorded' : ', no recorded activity'}${isSelected ? ', selected' : ''}`} aria-pressed={isSelected} onClick={() => onDateChange(key)}><span>{date.getDate()}</span>{hasActivity && <i aria-hidden="true" />}</button>
          })}
        </div>
        <div className="calendar-legend"><span><i className="legend-activity" /> Saved activity</span><span><i className="legend-today" /> Today</span><span><i className="legend-selected" /> Selected</span></div>
      </section>

      {selectedDay && <section className="selected-day-card glass" aria-labelledby="selected-day-title">
        <div className="selected-day-heading"><div><span className="section-kicker"><Flame size={13} /> SELECTED DAY</span><h2 id="selected-day-title">{formatISODate(selectedDate)}</h2></div><span className="selected-study-total"><Clock3 size={15} /> {formatDuration(selectedDay.focusedSeconds)} focused</span></div>
        {selectedDay.sessions.length === 0 && selectedDay.tasks.length === 0 && !selectedDay.habits.some((item) => item.completed) ? <p className="selected-day-empty">No saved study sessions, completed tasks, or habit check-ins for this date.</p> : <div className="selected-day-columns">
          <div className="day-record-group"><h3>Study sessions <span>{selectedDay.sessions.length}</span></h3>{selectedDay.sessions.length ? selectedDay.sessions.map((session) => <StudySessionRow key={session.id} session={session} />) : <p className="record-empty">No study sessions.</p>}</div>
          <div className="day-record-group"><h3>Completed tasks <span>{selectedDay.tasks.filter((item) => item.completed).length} / {selectedDay.tasks.length}</span></h3>{selectedDay.tasks.length ? selectedDay.tasks.map(({ task, completed }) => <div className={`day-record-row ${completed ? 'record-complete' : ''}`} key={task.id}><span className="record-state" aria-hidden="true">{completed ? <Check size={13} /> : null}</span><span>{task.title}</span>{task.time && <time>{task.time}</time>}</div>) : <p className="record-empty">No tasks scheduled.</p>}</div>
          <div className="day-record-group"><h3>Habit check-ins <span>{selectedDay.habits.filter((item) => item.completed).length} / {selectedDay.habits.length}</span></h3>{selectedDay.habits.length ? selectedDay.habits.map(({ habit, completed }) => <div className={`day-record-row ${completed ? 'record-complete' : ''}`} key={habit.id}><span className="record-state" aria-hidden="true">{completed ? <Check size={13} /> : null}</span><span>{habit.icon} {habit.name}</span><small>{habit.kind === 'core' ? 'Core' : 'Optional'}</small></div>) : <p className="record-empty">No habits were active on this date.</p>}</div>
        </div>}
      </section>}

      <section className="heatmap-card glass" aria-labelledby="study-heatmap-title">
        <div className="heatmap-heading"><div><span className="section-kicker"><Activity size={13} /> CONSISTENCY</span><h2 id="study-heatmap-title">Study activity · past 12 months</h2></div><span className="heatmap-total">{formatDuration(sumRange(sessions, heatmap.start, heatmap.end))} total</span></div>
        <div className="heatmap-scroll" tabIndex={0} role="region" aria-label="Study activity heatmap for the previous twelve months; scroll horizontally on small screens">
          <div className="heatmap-month-labels" style={{ '--heat-weeks': heatWeeks.length } as React.CSSProperties}>{heatWeeks.map((_, index) => <span key={index}>{monthLabelColumns.get(index) ?? ''}</span>)}</div>
          <div className="heatmap-content"><div className="heatmap-weekday-labels" aria-hidden="true"><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span>Sun</span></div><div className="heatmap-grid" style={{ '--heat-weeks': heatWeeks.length } as React.CSSProperties}>
            {heatmap.dates.map((date, index) => {
              const key = toISODate(date)
              const inRange = key >= heatmap.start && key <= heatmap.end
              const seconds = heatmap.secondsByDate.get(key) ?? 0
              const intensity = studyIntensity(seconds)
              if (!inRange) return <span key={key} className="heatmap-cell heatmap-blank" aria-hidden="true" style={{ gridColumn: Math.floor(index / 7) + 1, gridRow: index % 7 + 1 }} />
              const label = `${formatISODate(key)}: ${formatDuration(seconds)} focused study`
              return <button type="button" key={key} className={`heatmap-cell level-${intensity} ${key === selectedDate ? 'heatmap-selected' : ''}`} title={label} aria-label={label} aria-pressed={key === selectedDate} onClick={() => onDateChange(key)} style={{ gridColumn: Math.floor(index / 7) + 1, gridRow: index % 7 + 1 }} />
            })}
          </div></div>
        </div>
        <div className="heatmap-legend"><span>Less</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={`heatmap-cell level-${level}`} aria-hidden="true" />)}<span>More</span><small>Each square shows focused time saved for that local date.</small></div>
      </section>
    </>}</section>
}

function StudySessionRow({ session }: { session: FocusSession }) {
  return <div className="day-record-row study-record-row"><span className="record-state"><BookOpen size={12} /></span><span><strong>{session.subject}</strong><small>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(session.startedAt)} · {session.kind}</small></span><b>{formatDuration(session.durationSeconds)}</b></div>
}

function sumRange(sessions: FocusSession[], start: ISODate, end: ISODate) {
  return sessions.reduce((total, session) => total + (session.date >= start && session.date <= end ? session.durationSeconds : 0), 0)
}
