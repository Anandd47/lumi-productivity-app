import { useEffect } from 'react'
import { App } from '@capacitor/app'
import type { NotificationPreferences } from '../../domain/types'
import { toISODate } from '../../domain/date'
import { claimReminder } from '../profile/repository'
import { getSettings, listFocusSessions } from '../focus/repository'
import { getNotificationPlatform, reconcileNativeReminders } from './notificationService'
import { canSendNotification, shouldSendGoalReminder } from './notifications'

export function useReminderScheduler(preferences: NotificationPreferences | undefined) {
  useEffect(() => {
    const platform = getNotificationPlatform()
    let active = true
    const refreshNative = () => {
      if (platform !== 'android' || !preferences) return
      void reconcileNativeReminders(preferences).catch((error) => {
        if (import.meta.env.DEV) console.error('Lumi could not reconcile native reminders', error)
      })
    }
    if (platform === 'android') {
      refreshNative()
      const handleStudyDataChange = () => refreshNative()
      const handleVisibility = () => { if (document.visibilityState === 'visible') refreshNative() }
      window.addEventListener('lumi:study-data-changed', handleStudyDataChange)
      document.addEventListener('visibilitychange', handleVisibility)
      window.addEventListener('focus', handleVisibility)
      const appStateListener = App.addListener('appStateChange', ({ isActive }) => { if (isActive) refreshNative() })
      return () => {
        active = false
        window.removeEventListener('lumi:study-data-changed', handleStudyDataChange)
        document.removeEventListener('visibilitychange', handleVisibility)
        window.removeEventListener('focus', handleVisibility)
        void appStateListener.then((listener) => listener.remove())
      }
    }
    const secureContext = typeof isSecureContext === 'undefined' || isSecureContext
    if (platform !== 'web' || !preferences?.enabled || !secureContext || !canSendNotification(typeof Notification !== 'undefined', typeof Notification === 'undefined' ? null : Notification.permission)) return
    const reminderPreferences = preferences

    async function check() {
      if (!active || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      const now = new Date()
      const date = toISODate(now)
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const send = async (kind: 'study' | 'goal' | 'sleep', at: string, title: string, body: string) => {
        if (time !== at || !active) return
        if (kind === 'goal') {
          try {
            const [todaySessions, currentSettings] = await Promise.all([listFocusSessions(date), getSettings()])
            const focusedToday = todaySessions.reduce((sum, session) => sum + session.durationSeconds, 0)
            if (!shouldSendGoalReminder(focusedToday, currentSettings.studyTargetSeconds)) return
          } catch { return }
        }
        try {
          if (await claimReminder(kind, date) && active && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.svg', tag: `lumi-${kind}-${date}` })
          }
        } catch { /* The local page can continue if browser notification storage is unavailable. */ }
      }

      if (reminderPreferences.studyReminderEnabled) await send('study', reminderPreferences.studyReminderTime, 'A little focus goes a long way', 'Take a moment for a Lumi study session.')
      if (reminderPreferences.goalReminderEnabled) await send('goal', reminderPreferences.goalReminderTime, 'Your daily study goal', 'There is still time for a focused study session today.')
      if (reminderPreferences.sleepReminderEnabled) await send('sleep', reminderPreferences.sleepReminderTime, 'Wind down for sleep', 'A calm bedtime can support your sleep goal.')
    }

    void check()
    const interval = window.setInterval(() => void check(), 30_000)
    return () => { active = false; window.clearInterval(interval) }
  }, [preferences])
}
