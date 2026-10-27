export type NotificationPermissionStatus = 'Not requested' | 'Granted' | 'Denied' | 'Unsupported'

export function notificationPermissionStatus(apiAvailable: boolean, permission?: NotificationPermission | null): NotificationPermissionStatus {
  if (!apiAvailable) return 'Unsupported'
  if (permission === 'granted') return 'Granted'
  if (permission === 'denied') return 'Denied'
  return 'Not requested'
}

export function canSendNotification(apiAvailable: boolean, permission?: NotificationPermission | null): boolean {
  return apiAvailable && permission === 'granted'
}

export function notificationEnableAction(apiAvailable: boolean, permission?: NotificationPermission | null): 'unsupported' | 'denied' | 'request' | 'enabled' {
  if (!apiAvailable) return 'unsupported'
  if (permission === 'denied') return 'denied'
  return permission === 'granted' ? 'enabled' : 'request'
}

export function shouldSendGoalReminder(focusedSeconds: number, targetSeconds: number): boolean {
  return focusedSeconds < targetSeconds
}
