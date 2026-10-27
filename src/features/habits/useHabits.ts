import { useCallback, useEffect, useRef, useState } from 'react'
import type { DailyLog, Habit, ISODate } from '../../domain/types'
import { dateFromISO, toISODate } from '../../domain/date'
import { getDailyLog, listHabits } from './repository'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected storage error occurred.'
}

export function useHabits(selectedDate: ISODate) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null)
  const [weekLogs, setWeekLogs] = useState<DailyLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const requestId = useRef(0)

  const loadWeekLogs = useCallback(() => {
    const monday = dateFromISO(selectedDate)
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    return Promise.all(Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      return getDailyLog(toISODate(date))
    }))
  }, [selectedDate])

  const reload = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const [nextHabits, nextLog, nextWeekLogs] = await Promise.all([listHabits(), getDailyLog(selectedDate), loadWeekLogs()])
      if (requestId.current === currentRequest) {
        setHabits(nextHabits)
        setDailyLog(nextLog)
        setWeekLogs(nextWeekLogs)
      }
    } catch {
      if (requestId.current === currentRequest) setError('Lumi couldn’t load your habits. Please try again.')
    } finally {
      if (requestId.current === currentRequest) setLoading(false)
    }
  }, [loadWeekLogs, selectedDate])

  useEffect(() => {
    void reload()
    return () => { requestId.current += 1 }
  }, [reload])

  const mutate = useCallback(async (operation: () => Promise<unknown>, successMessage: string): Promise<boolean> => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await operation()
    } catch (cause) {
      setError(`Lumi couldn't save your change. Your previous saved data is unchanged. ${errorMessage(cause)}`)
      setSaving(false)
      return false
    }

    try {
      const [nextHabits, nextLog, nextWeekLogs] = await Promise.all([listHabits(), getDailyLog(selectedDate), loadWeekLogs()])
      setHabits(nextHabits)
      setDailyLog(nextLog)
      setWeekLogs(nextWeekLogs)
      setNotice(successMessage)
      return true
    } catch (cause) {
      setError(`Your change may have been saved, but Lumi couldn't refresh the screen. Reload to check. ${errorMessage(cause)}`)
      return false
    } finally {
      setSaving(false)
    }
  }, [loadWeekLogs, selectedDate])

  return { habits, dailyLog, weekLogs, loading, saving, error, notice, reload, mutate }
}
