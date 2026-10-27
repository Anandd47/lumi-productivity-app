import { useCallback, useEffect, useState } from 'react'
import type { LumiSettings, SleepRecord } from '../../domain/types'
import { createSleepRecord, deleteSleepRecord, listSleepRecords, setSleepTargetMinutes, updateSleepRecord, type SleepInput } from './repository'
import { getSettings } from '../focus/repository'

function errorText(error: unknown) { return error instanceof Error ? error.message : 'Unexpected storage error.' }

export function useSleepData() {
  const [records, setRecords] = useState<SleepRecord[]>([])
  const [settings, setSettings] = useState<LumiSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextRecords, nextSettings] = await Promise.all([listSleepRecords(), getSettings()])
      setRecords(nextRecords)
      setSettings(nextSettings)
    } catch (cause) { setError(`Lumi couldn't load sleep history. ${errorText(cause)}`) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void reload() }, [reload])

  const saveRecord = useCallback(async (input: SleepInput, id?: string) => {
    setSaving(true); setError(null); setNotice(null)
    try {
      if (id) await updateSleepRecord(id, input)
      else await createSleepRecord(input)
      setRecords(await listSleepRecords())
      setNotice(id ? 'Sleep record updated.' : 'Sleep record saved on this device.')
      return true
    } catch (cause) { setError(errorText(cause)); return false }
    finally { setSaving(false) }
  }, [])

  const removeRecord = useCallback(async (id: string) => {
    setSaving(true); setError(null); setNotice(null)
    try {
      await deleteSleepRecord(id)
      setRecords(await listSleepRecords())
      setNotice('Sleep record deleted.')
      return true
    } catch (cause) { setError(`Lumi couldn't delete that sleep record. ${errorText(cause)}`); return false }
    finally { setSaving(false) }
  }, [])

  const updateGoal = useCallback(async (minutes: number) => {
    setSaving(true); setError(null); setNotice(null)
    try {
      setSettings(await setSleepTargetMinutes(minutes))
      setNotice('Daily sleep goal saved on this device.')
      return true
    } catch (cause) { setError(errorText(cause)); return false }
    finally { setSaving(false) }
  }, [])

  return { records, settings, loading, saving, error, notice, reload, saveRecord, removeRecord, updateGoal }
}
