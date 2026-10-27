import { Capacitor } from '@capacitor/core'
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications'
import type { ISODate } from '../../domain/types'
import type { NotificationPreferences } from '../../domain/types'
import { getSettings, listAllFocusSessions } from '../focus/repository'
import { isManagedReminderId, buildNativeReminderPlan, TEST_NOTIFICATION_ID } from './reminderSchedule'

export type NotificationPlatform = 'android' | 'web' | 'unsupported'
export type NotificationAccess = 'Checking' | 'Not requested' | 'Granted' | 'Denied' | 'Unsupported'

export function getNotificationPlatform(): NotificationPlatform {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('LocalNotifications') ? 'android' : 'unsupported'
  }
  return 'web'
}

function permissionFromNative(value: string): NotificationAccess {
  if (value === 'granted') return 'Granted'
  if (value === 'denied') return 'Denied'
  return 'Not requested'
}

export async function readNotificationAccess(): Promise<NotificationAccess> {
  const platform = getNotificationPlatform()
  if (platform === 'android') return permissionFromNative((await LocalNotifications.checkPermissions()).display)
  if (platform !== 'web' || typeof Notification === 'undefined' || (typeof isSecureContext !== 'undefined' && !isSecureContext)) return 'Unsupported'
  if (Notification.permission === 'granted') return 'Granted'
  if (Notification.permission === 'denied') return 'Denied'
  return 'Not requested'
}

/** Call only from an explicit enable or test action. */
export async function requestNotificationAccess(): Promise<NotificationAccess> {
  const platform = getNotificationPlatform()
  if (platform === 'android') return permissionFromNative((await LocalNotifications.requestPermissions()).display)
  if (platform !== 'web' || typeof Notification === 'undefined' || (typeof isSecureContext !== 'undefined' && !isSecureContext)) return 'Unsupported'
  return permissionFromNative(await Notification.requestPermission())
}

export async function sendTestSystemNotification(): Promise<'android' | 'web'> {
  const platform = getNotificationPlatform()
  if (platform === 'android') {
    await LocalNotifications.createChannel({ id: 'lumi-reminders', name: 'Lumi reminders', description: 'Study and sleep reminders', importance: 3 })
    await LocalNotifications.cancel({ notifications: [{ id: TEST_NOTIFICATION_ID }] })
    await LocalNotifications.schedule({ notifications: [{
      id: TEST_NOTIFICATION_ID,
      title: 'Lumi is ready',
      body: 'This is a test notification from Lumi.',
      schedule: { at: new Date(Date.now() + 2500) },
      isExactNotification: false,
      channelId: 'lumi-reminders',
    }] })
    return 'android'
  }
  if (platform === 'web' && typeof Notification !== 'undefined' && (typeof isSecureContext === 'undefined' || isSecureContext)) {
    new Notification('Lumi is ready', { body: 'This is a test notification from Lumi.', icon: '/favicon.svg', tag: 'lumi-test' })
    return 'web'
  }
  throw new Error('System notifications are not supported in this app context.')
}

let reconcileQueue = Promise.resolve()

/** Reconcile stable native IDs against saved preferences and actual dated study records. */
export function reconcileNativeReminders(preferences: NotificationPreferences): Promise<void> {
  const task = reconcileQueue.then(() => reconcileNativeRemindersNow(preferences))
  reconcileQueue = task.catch(() => undefined)
  return task
}

async function reconcileNativeRemindersNow(preferences: NotificationPreferences): Promise<void> {
  if (getNotificationPlatform() !== 'android') return
  const pending = await LocalNotifications.getPending()
  const oldManaged = pending.notifications.filter((notification) => isManagedReminderId(notification.id)).map(({ id }) => ({ id }))
  if (oldManaged.length) await LocalNotifications.cancel({ notifications: oldManaged })
  if (!preferences.enabled) return
  const access = permissionFromNative((await LocalNotifications.checkPermissions()).display)
  if (access !== 'Granted') return

  await LocalNotifications.createChannel({ id: 'lumi-reminders', name: 'Lumi reminders', description: 'Study and sleep reminders', importance: 3 })
  const [settings, sessions] = await Promise.all([getSettings(), listAllFocusSessions()])
  const focusedSecondsByDate = new Map<ISODate, number>()
  for (const session of sessions) focusedSecondsByDate.set(session.date, (focusedSecondsByDate.get(session.date) ?? 0) + session.durationSeconds)
  const now = new Date()
  const plan = buildNativeReminderPlan(preferences, settings.studyTargetSeconds, focusedSecondsByDate, now)
  // The study and sleep reminders repeat at the device's local wall-clock time.
  // The goal reminder is intentionally one-shot per local date, so saved data can
  // suppress it and reconciliation can replace future instances safely.
  const notifications: LocalNotificationSchema[] = plan.map((reminder) => ({
    ...reminder,
    schedule: reminder.schedule,
  }))
  if (notifications.length) await LocalNotifications.schedule({ notifications })
}
