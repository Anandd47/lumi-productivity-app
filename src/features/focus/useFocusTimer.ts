import { useCallback, useEffect, useRef, useState } from 'react'
import { toISODate } from '../../domain/date'
import type { FocusTimerState } from '../../domain/types'
import { commitTimerTransition, focusSessionDate, getTimerState } from './repository'
import { discardTimerState, elapsedTimerSeconds, remainingTimerSeconds, resetTimerState } from './timer'

function errorText(error: unknown) { return error instanceof Error ? error.message : 'An unexpected storage error occurred.' }

export function useFocusTimer(displayActive = true) {
  const [state, setState] = useState<FocusTimerState | null>(null)
  const stateRef = useRef<FocusTimerState | null>(null)
  const [now, setNow] = useState(Date.now())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [sessionVersion, setSessionVersion] = useState(0)
  const lock = useRef(false)
  const expiredAttempt = useRef<number | null>(null)

  const reload = useCallback(async () => {
    setError(null)
    try { const saved = await getTimerState(); stateRef.current = saved; setState(saved) }
    catch (cause) { setError(`Lumi couldn't load the saved timer. ${errorText(cause)}`) }
  }, [])
  useEffect(() => { void reload() }, [reload])

  const persist = useCallback(async (next: FocusTimerState, session?: Parameters<typeof commitTimerTransition>[1], successMessage?: string) => {
    if (lock.current) return false
    lock.current = true; setSaving(true); setError(null); setNotice(null)
    try {
      await commitTimerTransition(next, session)
      stateRef.current = next; setState(next)
      if (session) setSessionVersion((version) => version + 1)
      if (successMessage) setNotice(successMessage)
      return true
    } catch (cause) {
      setError(`Lumi couldn't save the timer change. Your previous timer state remains saved. ${errorText(cause)}`)
      return false
    } finally { lock.current = false; setSaving(false) }
  }, [])

  const advanceExpired = useCallback(async (current: FocusTimerState) => {
    if (current.status !== 'running' || current.endsAt === null || current.endsAt > Date.now()) return
    const plannedEnd = current.endsAt
    if (current.kind === 'pomodoro' && current.phase === 'focus') {
      const durationSeconds = current.focusSeconds
      const next: FocusTimerState = { ...current, phase: 'break', status: 'running', remainingSeconds: current.breakSeconds, accumulatedSeconds: 0, sessionStartedAt: null, startedAt: null, endsAt: plannedEnd + current.breakSeconds * 1000, updatedAt: Date.now() }
      await persist(next, { date: focusSessionDate(current.sessionStartedAt ?? plannedEnd - durationSeconds * 1000), subject: current.subject, startedAt: current.sessionStartedAt ?? plannedEnd - durationSeconds * 1000, endedAt: plannedEnd, durationSeconds, kind: 'pomodoro' }, 'Focus complete. Your session was saved; break time begins.')
    } else {
      const next: FocusTimerState = { ...current, phase: 'focus', status: 'idle', remainingSeconds: current.kind === 'countdown' ? current.countdownSeconds : current.focusSeconds, accumulatedSeconds: 0, sessionStartedAt: null, startedAt: null, endsAt: null, updatedAt: Date.now() }
      const elapsed = current.kind === 'countdown' ? current.countdownSeconds : 0
      const session = elapsed > 0 ? { date: focusSessionDate(current.sessionStartedAt ?? plannedEnd - elapsed * 1000), subject: current.subject, startedAt: current.sessionStartedAt ?? plannedEnd - elapsed * 1000, endedAt: plannedEnd, durationSeconds: elapsed, kind: current.kind } : undefined
      await persist(next, session, session ? 'Countdown complete. Your focused time was saved.' : 'Break complete. Ready for another focus session?')
    }
  }, [persist])

  useEffect(() => {
    if (!state) return
    if (state.status !== 'running') {
      if (displayActive) setNow(Date.now())
      return
    }
    let interval: number | undefined
    let deadlineTimeout: number | undefined
    const clearScheduledTick = () => {
      if (interval !== undefined) window.clearInterval(interval)
      if (deadlineTimeout !== undefined) window.clearTimeout(deadlineTimeout)
      interval = undefined
      deadlineTimeout = undefined
    }
    const tick = () => {
      const current = stateRef.current
      const currentTime = Date.now()
      if (displayActive) setNow(currentTime)
      if (current?.status === 'running' && current.endsAt !== null && current.endsAt <= currentTime && expiredAttempt.current !== current.endsAt) {
        expiredAttempt.current = current.endsAt
        void advanceExpired(current)
      }
    }
    const scheduleDeadlineCheck = () => {
      const endsAt = stateRef.current?.endsAt
      if (endsAt === null || endsAt === undefined) return
      deadlineTimeout = window.setTimeout(tick, Math.max(0, endsAt - Date.now() + 100))
    }
    const startVisibleTimer = () => {
      clearScheduledTick()
      tick()
      if (document.visibilityState !== 'visible') return
      if (displayActive) {
        interval = window.setInterval(tick, 1000)
      } else scheduleDeadlineCheck()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearScheduledTick()
        return
      }
      startVisibleTimer()
    }
    startVisibleTimer()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      clearScheduledTick()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [state, advanceExpired, displayActive])

  const configure = useCallback((changes: Partial<Pick<FocusTimerState, 'kind' | 'focusSeconds' | 'breakSeconds' | 'countdownSeconds' | 'subject'>>) => {
    const current = stateRef.current
    if (!current || current.status !== 'idle') return
    const kind = changes.kind ?? current.kind
    const remainingSeconds = kind === 'countdown' ? changes.countdownSeconds ?? current.countdownSeconds : kind === 'stopwatch' ? 0 : changes.focusSeconds ?? current.focusSeconds
    const next = { ...current, ...changes, phase: 'focus' as const, remainingSeconds, updatedAt: Date.now() }
    void persist(next)
  }, [persist])

  const start = useCallback(() => {
    const current = stateRef.current
    if (!current || current.status === 'running') return
    const time = Date.now()
    const duration = current.kind === 'stopwatch' ? 0 : current.status === 'paused' ? current.remainingSeconds : current.kind === 'countdown' ? current.countdownSeconds : current.phase === 'break' ? current.breakSeconds : current.focusSeconds
    const next: FocusTimerState = { ...current, status: 'running', remainingSeconds: duration, startedAt: time, sessionStartedAt: current.sessionStartedAt ?? (current.phase === 'break' ? null : time), endsAt: duration > 0 ? time + duration * 1000 : null, updatedAt: time }
    void persist(next)
  }, [persist])

  const pause = useCallback(() => {
    const current = stateRef.current
    if (!current || current.status !== 'running') return
    const time = Date.now()
    const remaining = remainingTimerSeconds(current, time)
    const accumulated = current.kind === 'stopwatch' ? elapsedTimerSeconds(current, time) : current.accumulatedSeconds
    void persist({ ...current, status: 'paused', remainingSeconds: remaining, accumulatedSeconds: accumulated, startedAt: null, endsAt: null, updatedAt: time })
  }, [persist])

  const stopAndSave = useCallback(() => {
    const current = stateRef.current
    if (!current || current.status === 'idle') return
    const time = Date.now()
    const elapsed = current.phase === 'break' ? 0 : elapsedTimerSeconds(current, time)
    const startedAt = current.sessionStartedAt ?? Math.max(0, time - elapsed * 1000)
    const next: FocusTimerState = { ...current, status: 'idle', phase: 'focus', remainingSeconds: current.kind === 'countdown' ? current.countdownSeconds : current.focusSeconds, accumulatedSeconds: 0, sessionStartedAt: null, startedAt: null, endsAt: null, updatedAt: time }
    const session = elapsed > 0 ? { date: toISODate(new Date(startedAt)), subject: current.subject, startedAt, endedAt: time, durationSeconds: elapsed, kind: current.kind } : undefined
    void persist(next, session, session ? 'Focused time saved to your study log.' : 'Timer stopped.')
  }, [persist])

  const reset = useCallback(() => {
    const current = stateRef.current
    if (!current || current.status === 'idle') return
    void persist(resetTimerState(current), undefined, 'Timer reset. No study time was recorded.')
  }, [persist])

  const discard = useCallback(() => {
    const current = stateRef.current
    if (!current || current.status === 'idle') return
    void persist(discardTimerState(current), undefined, 'Unfinished session discarded. Saved study history was not changed.')
  }, [persist])

  const retry = useCallback(() => {
    const current = stateRef.current
    if (current?.status === 'running' && current.endsAt !== null && current.endsAt <= Date.now()) {
      expiredAttempt.current = null
      void advanceExpired(current)
    } else void reload()
  }, [advanceExpired, reload])

  const elapsedSeconds = !state ? 0 : elapsedTimerSeconds(state, now)
  const displaySeconds = !state ? 0 : state.kind === 'stopwatch' ? elapsedSeconds : remainingTimerSeconds(state, now)
  return { state, displaySeconds, elapsedSeconds, loading: !state && !error, saving, error, notice, sessionVersion, configure, start, pause, stopAndSave, reset, discard, retry }
}
