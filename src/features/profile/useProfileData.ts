import { useCallback, useEffect, useState } from 'react'
import type { LumiSettings } from '../../domain/types'
import { getSettings } from '../focus/repository'
import { exportLumiData, getLocalDataCounts, replaceLumiData, saveProfile, type LumiBackup, type ProfileInput, saveNotificationPreferences } from './repository'

function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Unexpected local storage error.' }

export function useProfileData() {
  const [settings, setSettings] = useState<LumiSettings | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [saved, dataCounts] = await Promise.all([getSettings(), getLocalDataCounts()])
      setSettings(saved); setCounts(dataCounts)
    } catch (cause) { setError(`Lumi couldn't load profile settings. ${errorMessage(cause)}`) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void reload() }, [reload])

  const saveProfileSettings = useCallback(async (input: ProfileInput) => {
    setSaving(true); setError(null); setNotice(null)
    try { setSettings(await saveProfile(input)); setNotice('Profile and daily goals saved on this device.'); return true }
    catch (cause) { setError(errorMessage(cause)); return false }
    finally { setSaving(false) }
  }, [])

  const saveNotifications = useCallback(async (notifications: NonNullable<LumiSettings['notifications']>) => {
    setSaving(true); setError(null); setNotice(null)
    try { setSettings(await saveNotificationPreferences(notifications)); setNotice('Notification preferences saved on this device.'); return true }
    catch (cause) { setError(errorMessage(cause)); return false }
    finally { setSaving(false) }
  }, [])

  const exportData = useCallback(async () => {
    setError(null); setNotice(null)
    try { return await exportLumiData() }
    catch (cause) { setError(`Lumi couldn't export your data. ${errorMessage(cause)}`); return null }
  }, [])

  const importData = useCallback(async (backup: LumiBackup) => {
    setSaving(true); setError(null); setNotice(null)
    try { await replaceLumiData(backup); await reload(); setNotice('Lumi backup restored. All prior local records were replaced.'); return true }
    catch (cause) { setError(`Lumi couldn't restore the backup. ${errorMessage(cause)}`); return false }
    finally { setSaving(false) }
  }, [reload])

  return { settings, counts, loading, saving, error, notice, reload, saveProfileSettings, saveNotifications, exportData, importData, setError, setNotice }
}
