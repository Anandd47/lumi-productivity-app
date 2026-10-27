import type { FocusSession } from '../../domain/types'

export function summarizeStudy(sessions: FocusSession[], targetSeconds: number) {
  const secondsBySubject = new Map<string, number>()
  let totalSeconds = 0
  for (const session of sessions) {
    totalSeconds += session.durationSeconds
    secondsBySubject.set(session.subject, (secondsBySubject.get(session.subject) ?? 0) + session.durationSeconds)
  }
  return { totalSeconds, targetSeconds, percent: targetSeconds > 0 ? Math.min(100, Math.round(totalSeconds / targetSeconds * 100)) : 0, subjects: [...secondsBySubject].map(([subject, seconds]) => ({ subject, seconds })).sort((a, b) => b.seconds - a.seconds) }
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  if (safe === 0) return '0m'
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor(safe % 3600 / 60)
  const remainder = safe % 60
  if (hours) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  if (minutes) return `${minutes}m ${String(remainder).padStart(2, '0')}s`
  return `${remainder}s`
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(safe / 3600)).padStart(2, '0')}:${String(Math.floor(safe % 3600 / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}
