import { useCallback, useEffect, useState } from 'react'
import type { ActivityEntry, LumiSettings, WaterEntry } from '../../domain/types'
import { getSettings } from '../focus/repository'
import { createActivityEntry, createWaterEntry, deleteActivityEntry, deleteWaterEntry, listActivityEntries, listWaterEntries, setWaterGoalGlasses, updateActivityEntry, updateWaterEntry, type ActivityInput, type WaterInput } from './repository'

function errorText(error: unknown) { return error instanceof Error ? error.message : 'Unexpected storage error.' }

export function useHealthData() {
  const [waterEntries, setWaterEntries] = useState<WaterEntry[]>([])
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([])
  const [settings, setSettings] = useState<LumiSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [water, activities, savedSettings] = await Promise.all([listWaterEntries(), listActivityEntries(), getSettings()])
      setWaterEntries(water); setActivityEntries(activities); setSettings(savedSettings)
    } catch (cause) { setError(`Lumi couldn't load health history. ${errorText(cause)}`) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void reload() }, [reload])

  const saveWater = useCallback(async (input: WaterInput, id?: string) => {
    setSaving(true); setError(null); setNotice(null)
    try {
      if (id) await updateWaterEntry(id, input); else await createWaterEntry(input)
      setWaterEntries(await listWaterEntries()); setNotice(id ? 'Water entry updated.' : 'Water entry saved on this device.'); return true
    } catch (cause) { setError(errorText(cause)); return false }
    finally { setSaving(false) }
  }, [])

  const saveActivity = useCallback(async (input: ActivityInput, id?: string) => {
    setSaving(true); setError(null); setNotice(null)
    try {
      if (id) await updateActivityEntry(id, input); else await createActivityEntry(input)
      setActivityEntries(await listActivityEntries()); setNotice(id ? 'Activity entry updated.' : 'Activity entry saved on this device.'); return true
    } catch (cause) { setError(errorText(cause)); return false }
    finally { setSaving(false) }
  }, [])

  const removeWater = useCallback(async (id: string) => {
    setSaving(true); setError(null); setNotice(null)
    try { await deleteWaterEntry(id); setWaterEntries(await listWaterEntries()); setNotice('Water entry deleted.'); return true }
    catch (cause) { setError(`Lumi couldn't delete that water entry. ${errorText(cause)}`); return false }
    finally { setSaving(false) }
  }, [])

  const removeActivity = useCallback(async (id: string) => {
    setSaving(true); setError(null); setNotice(null)
    try { await deleteActivityEntry(id); setActivityEntries(await listActivityEntries()); setNotice('Activity entry deleted.'); return true }
    catch (cause) { setError(`Lumi couldn't delete that activity entry. ${errorText(cause)}`); return false }
    finally { setSaving(false) }
  }, [])

  const updateWaterGoal = useCallback(async (glasses: number) => {
    setSaving(true); setError(null); setNotice(null)
    try { setSettings(await setWaterGoalGlasses(glasses)); setNotice('Daily water goal saved on this device.'); return true }
    catch (cause) { setError(errorText(cause)); return false }
    finally { setSaving(false) }
  }, [])

  return { waterEntries, activityEntries, settings, loading, saving, error, notice, reload, saveWater, saveActivity, removeWater, removeActivity, updateWaterGoal }
}
