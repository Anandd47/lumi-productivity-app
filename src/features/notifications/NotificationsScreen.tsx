import { useEffect, useState, type ReactNode } from 'react'
import { Bell, BellRing, Clock3, Moon, Target } from 'lucide-react'
import type { NotificationPreferences } from '../../domain/types'
import type { useProfileData } from '../profile/useProfileData'
import { getNotificationPlatform, readNotificationAccess, reconcileNativeReminders, requestNotificationAccess, sendTestSystemNotification, type NotificationAccess } from './notificationService'
import './notifications.css'

type ProfileData = ReturnType<typeof useProfileData>
const defaults: NotificationPreferences = { enabled: false, studyReminderEnabled: false, studyReminderTime: '09:00', goalReminderEnabled: false, goalReminderTime: '18:00', sleepReminderEnabled: false, sleepReminderTime: '22:00' }

function deniedHelp(platform: ReturnType<typeof getNotificationPlatform>) {
  return platform === 'android'
    ? 'Notifications are blocked. Open Android Settings → Apps → Lumi → Notifications and allow them, then return here.'
    : 'Notifications are blocked. Allow them for Lumi in your browser site settings, then return here.'
}

export function NotificationsScreen({ data }: { data: ProfileData }) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaults)
  const [permission, setPermission] = useState<NotificationAccess>('Checking')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const platform = getNotificationPlatform()
  const isNative = platform === 'android'
  const isWeb = platform === 'web'

  useEffect(() => { if (data.settings?.notifications) setPreferences(data.settings.notifications) }, [data.settings?.notifications])

  useEffect(() => {
    let active = true
    const refresh = () => { void readNotificationAccess().then((next) => { if (active) setPermission(next) }).catch(() => { if (active) setPermission('Unsupported') }) }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { active = false; window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])

  async function syncNative(next: NotificationPreferences) {
    if (!isNative) return true
    try {
      await reconcileNativeReminders(next)
      return true
    } catch (cause) {
      console.error('Lumi native reminder reconciliation failed', cause)
      setError('Your reminder preference was saved, but its Android schedule could not be updated. Please try again.')
      return false
    }
  }

  async function persist(next: NotificationPreferences, savedMessage = 'Notification preferences saved.') {
    setError(null)
    setMessage(null)
    if (!await data.saveNotifications(next)) {
      setError(data.error ?? 'Lumi could not save your notification preferences. Please try again.')
      return false
    }
    setPreferences(next)
    const scheduled = await syncNative(next)
    if (scheduled) setMessage(savedMessage)
    return true
  }

  async function enableNotifications() {
    setError(null)
    setMessage(null)
    if (permission === 'Unsupported') {
      setError(isNative ? 'Native notifications are unavailable in this installed app version. Update Lumi after its Android plugin is included.' : 'System notifications are unavailable here. Try a supported browser over HTTPS or localhost.')
      return
    }
    try {
      const result = permission === 'Granted' ? 'Granted' : await requestNotificationAccess()
      setPermission(result)
      if (result !== 'Granted') {
        setError(result === 'Denied' ? deniedHelp(platform) : 'Notification permission was not granted. You can enable it later in system or site settings.')
        return
      }
      const next = { ...preferences, enabled: true }
      await persist(next, isNative ? 'Lumi notifications are enabled on this device.' : 'Lumi notifications are enabled in this browser.')
    } catch (cause) {
      console.error('Lumi notification permission request failed', cause)
      setError('Lumi could not request notification permission. Check this app’s notification settings and try again.')
    }
  }

  async function toggleEnabled(enabled: boolean) {
    setError(null)
    setMessage(null)
    if (!enabled) {
      await persist({ ...preferences, enabled: false }, 'Lumi notifications are turned off.')
      return
    }
    await enableNotifications()
  }

  async function testNotification() {
    setError(null)
    setMessage(null)
    setTesting(true)
    try {
      let access = permission
      if (access !== 'Granted') {
        access = await requestNotificationAccess()
        setPermission(access)
      }
      if (access !== 'Granted') {
        setError(access === 'Denied' ? deniedHelp(platform) : access === 'Unsupported' ? 'System notifications are unsupported in this app context.' : 'Allow notifications to run the test.')
        return
      }
      const result = await sendTestSystemNotification()
      setMessage(result === 'android' ? 'Test notification scheduled. Check your phone’s notification shade in a few seconds.' : 'Test notification sent to your browser.')
    } catch (cause) {
      console.error('Lumi test notification failed', cause)
      setError('Lumi could not schedule the test notification. Check notification access and try again.')
    } finally {
      setTesting(false)
    }
  }

  async function update<K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) {
    const next = { ...preferences, [key]: value }
    await persist(next, isNative ? 'Reminder settings saved on this device.' : 'Reminder settings saved.')
  }

  const permissionText = permission === 'Checking' ? 'Checking…' : permission

  return <section className="notifications-screen" aria-labelledby="notifications-title">
    <header className="account-page-heading"><div><span className="section-kicker"><Bell size={13} /> YOUR PREFERENCES</span><h1 id="notifications-title">Notifications</h1><p>Choose reminders that help your day stay on track.</p></div></header>
    {error && <p className="account-feedback account-error" role="alert">{error}</p>}
    {message && <p className="account-feedback" role="status">{message}</p>}
    {data.error && <p className="account-feedback account-error" role="alert">{data.error}</p>}

    <section className="notification-panel glass" aria-labelledby="notification-access-title">
      <div className="notification-panel-heading"><div><h2 id="notification-access-title">Notification access</h2><p>Permission status: <strong>{permissionText}</strong></p></div><BellRing size={20} /></div>
      <label className="notification-toggle-row master-notification-toggle"><span><strong>Enable Lumi notifications</strong><small>Permission is requested only when you turn this on.</small></span><input type="checkbox" role="switch" checked={preferences.enabled} disabled={data.loading || data.saving || permission === 'Checking' || permission === 'Unsupported'} onChange={(event) => void toggleEnabled(event.target.checked)} /></label>
      {permission === 'Denied' && <p className="notification-help">{deniedHelp(platform)}</p>}
      {permission === 'Unsupported' && <p className="notification-help">{isNative ? 'This installed app version does not have native notification support. Install a build that includes Lumi’s Android notification plugin.' : 'System notifications are unsupported in this browser or page context. Use a current browser over HTTPS or localhost.'}</p>}
      <button type="button" className="secondary-button test-notification-button" disabled={testing || permission === 'Checking'} onClick={() => void testNotification()}><BellRing size={15} />{testing ? 'Scheduling test…' : 'Test notification'}</button>
    </section>

    <section className="notification-panel glass" aria-labelledby="reminder-options-title">
      <div className="notification-panel-heading"><div><h2 id="reminder-options-title">Scheduled reminders</h2><p>Times use your device’s local clock.</p></div><Clock3 size={20} /></div>
      <ReminderOption icon={<Bell size={17} />} title="Study session reminder" description="A gentle prompt to start a Focus session." checked={preferences.studyReminderEnabled} time={preferences.studyReminderTime} disabled={data.loading || data.saving} onToggle={(checked) => void update('studyReminderEnabled', checked)} onTime={(time) => void update('studyReminderTime', time)} />
      <ReminderOption icon={<Target size={17} />} title="Daily study goal reminder" description="Only scheduled when saved study time is below your goal." checked={preferences.goalReminderEnabled} time={preferences.goalReminderTime} disabled={data.loading || data.saving} onToggle={(checked) => void update('goalReminderEnabled', checked)} onTime={(time) => void update('goalReminderTime', time)} />
      <ReminderOption icon={<Moon size={17} />} title="Sleep schedule reminder" description="A gentle prompt to begin winding down." checked={preferences.sleepReminderEnabled} time={preferences.sleepReminderTime} disabled={data.loading || data.saving} onToggle={(checked) => void update('sleepReminderEnabled', checked)} onTime={(time) => void update('sleepReminderTime', time)} />
      <div className="unsupported-habit-reminder"><strong>Habit reminders</strong><span>Not available: habits do not have a reminder-time setting.</span></div>
      <p className="notification-limitation">{isNative ? 'Android delivers these reminders on-device, subject to notification permission and battery restrictions. Times are inexact. Daily-goal reminders use saved study history and are refreshed when Lumi opens or study data changes; they are prepared up to 30 days ahead.' : isWeb ? 'Browser reminders work only while Lumi is open. Browser timer throttling can delay them, and they will not fire after the page is closed.' : 'System notifications are unavailable in this app context.'}</p>
      {permission === 'Denied' && preferences.enabled && <p className="notification-help">{deniedHelp(platform)} Your reminder preferences remain saved.</p>}
    </section>
  </section>
}

function ReminderOption({ icon, title, description, checked, time, disabled, onToggle, onTime }: { icon: ReactNode; title: string; description: string; checked: boolean; time: string; disabled: boolean; onToggle: (checked: boolean) => void; onTime: (time: string) => void }) {
  return <div className="reminder-option"><span className="reminder-option-icon" aria-hidden="true">{icon}</span><div className="reminder-option-copy"><strong>{title}</strong><small>{description}</small></div><label className="reminder-time-label"><span className="visually-hidden">{title} time</span><input type="time" aria-label={title + ' time'} value={time} disabled={disabled} onChange={(event) => onTime(event.target.value)} /></label><input type="checkbox" role="switch" aria-label={'Enable ' + title.toLowerCase()} checked={checked} disabled={disabled} onChange={(event) => onToggle(event.target.checked)} /></div>
}

