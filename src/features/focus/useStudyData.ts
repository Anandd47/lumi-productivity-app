import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FocusSession, ISODate, LumiSettings } from '../../domain/types'
import { deleteFocusSession, getSettings, listFocusSessions, setStudyTargetSeconds } from './repository'

export function useStudyData(date: ISODate) {
  const [sessions, setSessions] = useState<FocusSession[]>([])
  const [settings, setSettings] = useState<LumiSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [nextSessions, nextSettings] = await Promise.all([listFocusSessions(date), getSettings()])
      setSessions(nextSessions); setSettings(nextSettings)
      window.dispatchEvent(new Event('lumi:study-data-changed'))
    } catch (cause) { setError(`Lumi couldn't load study data. ${cause instanceof Error ? cause.message : 'Unexpected storage error.'}`) }
    finally { setLoading(false) }
  }, [date])
  useEffect(() => { void reload() }, [reload])
  const updateTarget = useCallback(async (seconds: number) => {
    setSaving(true); setError(null); setNotice(null)
    try { setSettings(await setStudyTargetSeconds(seconds)); setNotice('Daily study target saved on this device.'); window.dispatchEvent(new Event('lumi:study-data-changed')) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the target.') }
    finally { setSaving(false) }
  }, [])
  const removeSession = useCallback(async (id: string) => {
    setSaving(true); setError(null); setNotice(null)
    try {
      await deleteFocusSession(id)
      setSessions(await listFocusSessions(date))
      window.dispatchEvent(new Event('lumi:study-data-changed'))
      setNotice('Saved study entry deleted.')
      return true
    } catch (cause) {
      setError(`Lumi couldn't delete that study entry. ${cause instanceof Error ? cause.message : 'Unexpected storage error.'}`)
      return false
    } finally { setSaving(false) }
  }, [date])
  return useMemo(() => ({ sessions, settings, loading, saving, error, notice, reload, updateTarget, removeSession }), [sessions, settings, loading, saving, error, notice, reload, updateTarget, removeSession])
}
