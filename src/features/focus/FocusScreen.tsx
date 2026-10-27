import { memo, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BookOpen, Check, Clock3, Pause, Play, RotateCcw, Square, TimerReset, Trash2 } from 'lucide-react'
import type { FocusTimerKind, ISODate } from '../../domain/types'
import { formatISODate } from '../../domain/date'
import { formatClock, formatDuration, summarizeStudy } from './progress'
import type { useFocusTimer } from './useFocusTimer'
import type { useStudyData } from './useStudyData'
import { useLumiConfirm } from '../../components/ConfirmDialog'
import './focus.css'

export function FocusScreen({ date, onDateChange, timer, study }: { date: ISODate; onDateChange: (date: ISODate) => void; timer: ReturnType<typeof useFocusTimer>; study: ReturnType<typeof useStudyData> }) {
  const studyTarget = study.settings?.studyTargetSeconds ?? 6 * 3600
  const summary = useMemo(() => summarizeStudy(study.sessions, studyTarget), [study.sessions, studyTarget])
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }), [])
  return <section className="focus-screen" aria-labelledby="focus-title">
    <div className="focus-page-heading"><div><span className="section-kicker"><Clock3 size={13} /> DEEP WORK</span><h1 id="focus-title">Focus &amp; Study</h1><p>Time spent studying is saved by date and subject.</p></div></div>
    <div className="focus-layout">
      <TimerPanel timer={timer} />
      <StudyPanel date={date} onDateChange={onDateChange} study={study} summary={summary} dateFormatter={dateFormatter} />
    </div>
  </section>
}

function TimerPanel({ timer }: { timer: ReturnType<typeof useFocusTimer> }) {
  const confirm = useLumiConfirm()
  const { state, displaySeconds, loading, saving, error, notice } = timer
  const [subject, setSubject] = useState('General')
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const [countdownMinutes, setCountdownMinutes] = useState(30)
  useEffect(() => {
    if (state) { setSubject(state.subject); setFocusMinutes(state.focusSeconds / 60); setBreakMinutes(state.breakSeconds / 60); setCountdownMinutes(state.countdownSeconds / 60) }
  }, [state?.id])

  function chooseKind(kind: FocusTimerKind) { timer.configure({ kind }) }
  function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!state) return
    timer.configure({ focusSeconds: Math.round(focusMinutes * 60), breakSeconds: Math.round(breakMinutes * 60), countdownSeconds: Math.round(countdownMinutes * 60), subject: subject.trim() || 'General' })
  }
  async function resetTimer() {
    if (await confirm({ title: 'Reset this timer?', description: 'The current unfinished focus interval will be discarded without adding study time. Saved study entries will remain unchanged.', confirmLabel: 'Reset timer', destructive: true })) timer.reset()
  }
  async function discardSession() {
    if (await confirm({ title: 'Discard this session?', description: 'This unfinished session will be canceled without recording study time. Saved study entries will remain unchanged.', confirmLabel: 'Discard session', destructive: true })) timer.discard()
  }
  const isActive = Boolean(state && state.status !== 'idle')
  const modeTitle = state?.kind === 'pomodoro' ? state.phase === 'break' ? 'Break' : 'Pomodoro focus' : state?.kind === 'countdown' ? 'Custom countdown' : 'Stopwatch'
  return <article className="focus-timer-card glass" aria-label="Focus timer">
    <div className="focus-card-heading"><div><span className="section-kicker"><TimerReset size={13} /> FOCUS TIMER</span><h2>{modeTitle}</h2></div></div>
    <div className="timer-state-row" role="status"><span className="timer-status">{loading ? 'Loading' : state?.status ?? 'idle'}</span><span>{loading ? 'Preparing your timer' : isActive ? state?.phase === 'break' ? 'Break in progress' : 'Focus session in progress' : 'Ready when you are'}</span></div>
    <div className="timer-mode-tabs" role="group" aria-label="Timer mode">
      {(['pomodoro', 'countdown', 'stopwatch'] as const).map((kind) => <button type="button" key={kind} className={state?.kind === kind ? 'selected' : ''} disabled={!state || state.status !== 'idle' || saving} onClick={() => chooseKind(kind)}>{kind === 'pomodoro' ? 'Pomodoro' : kind === 'countdown' ? 'Countdown' : 'Stopwatch'}</button>)}
    </div>
    <div className={`timer-face ${state?.status === 'running' ? 'timer-running' : ''}`} aria-live="off"><span>{state?.kind === 'stopwatch' ? 'ELAPSED' : state?.phase === 'break' ? 'BREAK' : 'TIME REMAINING'}</span><strong aria-label={`${formatClock(displaySeconds)} ${state?.kind === 'stopwatch' ? 'elapsed' : 'remaining'}`}>{formatClock(displaySeconds)}</strong></div>
    <div className="timer-controls">
      {state?.status === 'running' ? <button className="primary-button" type="button" disabled={saving} onClick={timer.pause}><Pause size={16} /> Pause</button> : <button className="primary-button" type="button" disabled={!state || loading || saving} onClick={timer.start}><Play size={16} /> {state?.status === 'paused' ? 'Resume' : 'Start focus'}</button>}
      {isActive && <>
        <button className="secondary-button" type="button" disabled={saving} onClick={timer.stopAndSave}><Square size={14} /> {state?.phase === 'break' ? 'End break' : 'Stop & Save'}</button>
        <button className="secondary-button" type="button" disabled={saving} onClick={() => void resetTimer()}><RotateCcw size={14} /> Reset timer</button>
        {state?.phase === 'focus' && <button className="text-action" type="button" disabled={saving} onClick={() => void discardSession()}>Discard session</button>}
      </>}
    </div>
    {state?.kind === 'pomodoro' && <p className="timer-hint">Focus sessions save automatically when the focus interval ends. Break time is not counted.</p>}
    {state?.status === 'idle' && <form className="timer-settings" onSubmit={saveConfiguration}>
      <label>Subject<input type="text" maxLength={64} value={subject} placeholder="e.g. Biology" onChange={(event) => setSubject(event.target.value)} /></label>
      {state.kind === 'pomodoro' && <div className="timer-duration-row"><label>Focus · minutes<input type="number" min={1} max={120} step={1} required value={focusMinutes} onChange={(event) => setFocusMinutes(Number(event.target.value))} /></label><label>Break · minutes<input type="number" min={1} max={60} step={1} required value={breakMinutes} onChange={(event) => setBreakMinutes(Number(event.target.value))} /></label></div>}
      {state.kind === 'countdown' && <label>Countdown · minutes<input type="number" min={1} max={720} step={1} required value={countdownMinutes} onChange={(event) => setCountdownMinutes(Number(event.target.value))} /></label>}
      <button type="submit" className="secondary-button" disabled={saving}>Save timer settings</button>
    </form>}
    {error && <p className="focus-message focus-error" role="alert">{error}<button type="button" onClick={timer.retry}>Retry</button></p>}{notice && <p className="focus-message" role="status">{notice}</p>}
  </article>
}

const StudyPanel = memo(function StudyPanel({ date, onDateChange, study, summary, dateFormatter }: { date: ISODate; onDateChange: (date: ISODate) => void; study: ReturnType<typeof useStudyData>; summary: ReturnType<typeof summarizeStudy>; dateFormatter: Intl.DateTimeFormat }) {
  const confirm = useLumiConfirm()
  const [targetHours, setTargetHours] = useState(6)
  useEffect(() => { if (study.settings) setTargetHours(study.settings.studyTargetSeconds / 3600) }, [study.settings?.studyTargetSeconds])
  const targetPercent = study.loading ? 0 : summary.percent
  return <article className="study-log-card glass" aria-labelledby="study-log-title">
    <div className="focus-card-heading"><div><span className="section-kicker"><BookOpen size={13} /> STUDY LOG</span><h2 id="study-log-title">Study time logged</h2></div></div>
    <label className="study-date-label">Study date<input aria-label="Study date" type="date" value={date} onChange={(event) => { if (event.target.value) onDateChange(event.target.value as ISODate) }} /></label>
    <p className="study-date-copy">{formatISODate(date)}</p>
    {study.error && <p className="focus-message focus-error" role="alert">{study.error}<button type="button" onClick={() => void study.reload()}>Retry</button></p>}
    <div className="study-total-row"><div className="study-ring" style={{ '--study-progress': `${targetPercent * 3.6}deg` } as React.CSSProperties}><div><strong>{formatDuration(summary.totalSeconds)}</strong><span>of {formatDuration(summary.targetSeconds)}</span></div></div><div className="study-total-copy"><strong>{targetPercent}%</strong><span>of daily target</span></div></div>
    <form className="study-target-form" onSubmit={(event) => { event.preventDefault(); void study.updateTarget(Math.round(targetHours * 3600)) }}><label>Daily target · hours<input aria-label="Daily study target in hours" type="number" min={1} max={24} step={0.5} required value={targetHours} disabled={study.saving} onChange={(event) => setTargetHours(Number(event.target.value))} /></label><button type="submit" className="secondary-button" disabled={study.saving}>Save target</button></form>
    {study.notice && <p className="focus-message" role="status"><Check size={14} />{study.notice}</p>}
    <div className="subject-summary"><h3>By subject</h3>{study.loading ? <p>Loading study sessions…</p> : summary.subjects.length === 0 ? <p>No focused time logged on this date yet. Start a timer to begin.</p> : summary.subjects.map((item) => <div className="subject-row" key={item.subject}><span>{item.subject}</span><strong>{formatDuration(item.seconds)}</strong></div>)}</div>
    <div className="session-history"><h3>Saved sessions</h3>{study.sessions.length === 0 ? <p>No sessions yet.</p> : [...study.sessions].reverse().map((session) => <div className="session-row" key={session.id}><span><strong>{session.subject}</strong><small>{dateFormatter.format(session.startedAt)} · {session.kind}</small></span><b>{formatDuration(session.durationSeconds)}</b><button className="session-delete" type="button" disabled={study.saving} aria-label={`Delete saved ${formatDuration(session.durationSeconds)} ${session.subject} study entry`} title="Delete this saved study entry" onClick={() => void deleteSavedSession(session.id, session.subject, formatDuration(session.durationSeconds))}><Trash2 size={15} /></button></div>)}</div>
  </article>
  async function deleteSavedSession(id: string, subject: string, duration: string) {
    if (await confirm({ title: 'Delete this study entry?', description: `${duration} for ${subject} will be permanently removed from your saved study history.`, confirmLabel: 'Delete entry', destructive: true })) void study.removeSession(id)
  }
})
