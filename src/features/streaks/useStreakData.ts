import { useCallback, useEffect, useState } from 'react'
import { toISODate } from '../../domain/date'
import type { DailyLog, GraceDay, Habit, ISODate } from '../../domain/types'
import { loadStreakHistory, removeGraceDay, useGraceDay } from './repository'
import { calculateStreakStats } from './streak'

function errorText(error: unknown) { return error instanceof Error ? error.message : 'Unexpected storage error.' }

export function useStreakData() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([])
  const [graceDays, setGraceDays] = useState<GraceDay[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const history = await loadStreakHistory()
      setHabits(history.habits); setDailyLogs(history.dailyLogs); setGraceDays(history.graceDays)
    } catch (cause) { setError(`Lumi couldn't load streak history. ${errorText(cause)}`) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void reload() }, [reload])

  const applyGrace = useCallback(async (date: ISODate) => {
    setSaving(true); setError(null); setNotice(null)
    try {
      const grace = await useGraceDay(date)
      const history = await loadStreakHistory()
      setHabits(history.habits); setDailyLogs(history.dailyLogs); setGraceDays(history.graceDays)
      setNotice(`Grace day used for ${grace.usedOn}. It protects your streak but does not add a qualifying day.`)
      return true
    } catch (cause) { setError(errorText(cause)); return false }
    finally { setSaving(false) }
  }, [])

  const undoGrace = useCallback(async (month: GraceDay['month']) => {
    setSaving(true); setError(null); setNotice(null)
    try {
      await removeGraceDay(month)
      const history = await loadStreakHistory()
      setHabits(history.habits); setDailyLogs(history.dailyLogs); setGraceDays(history.graceDays)
      setNotice('Grace day usage removed; streak history recalculated.')
      return true
    } catch (cause) { setError(errorText(cause)); return false }
    finally { setSaving(false) }
  }, [])

  const today = toISODate(new Date())
  const stats = calculateStreakStats(habits, dailyLogs, graceDays, today)
  return { habits, dailyLogs, graceDays, loading, saving, error, notice, reload, applyGrace, undoGrace, stats }
}
