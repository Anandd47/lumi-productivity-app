import type { FocusTimerState } from '../../domain/types'

export function remainingTimerSeconds(state: FocusTimerState, now: number): number {
  if (state.status === 'running' && state.endsAt !== null) return Math.max(0, Math.ceil((state.endsAt - now) / 1000))
  return Math.max(0, state.remainingSeconds)
}

export function elapsedTimerSeconds(state: FocusTimerState, now: number): number {
  if (state.kind === 'stopwatch') return state.accumulatedSeconds + (state.status === 'running' && state.startedAt !== null ? Math.max(0, Math.floor((now - state.startedAt) / 1000)) : 0)
  const target = state.kind === 'countdown' ? state.countdownSeconds : state.phase === 'break' ? state.breakSeconds : state.focusSeconds
  return Math.max(0, Math.min(target, target - remainingTimerSeconds(state, now)))
}

/** Reset an active interval to its configured duration without saving a study session. */
export function resetTimerState(state: FocusTimerState, now = Date.now()): FocusTimerState {
  const initial = state.kind === 'countdown' ? state.countdownSeconds : state.kind === 'stopwatch' ? 0 : state.focusSeconds
  return { ...state, phase: 'focus', status: 'paused', remainingSeconds: initial, accumulatedSeconds: 0, sessionStartedAt: null, startedAt: null, endsAt: null, updatedAt: now }
}

/** Discard the in-progress interval and return the timer to idle. Saved sessions are untouched. */
export function discardTimerState(state: FocusTimerState, now = Date.now()): FocusTimerState {
  const initial = state.kind === 'countdown' ? state.countdownSeconds : state.kind === 'stopwatch' ? 0 : state.focusSeconds
  return { ...state, phase: 'focus', status: 'idle', remainingSeconds: initial, accumulatedSeconds: 0, sessionStartedAt: null, startedAt: null, endsAt: null, updatedAt: now }
}
