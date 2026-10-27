export const screenPaths: Record<string, string> = {
  Home: '/',
  Tasks: '/tasks',
  Habits: '/habits',
  Focus: '/focus',
  More: '/more',
  Sleep: '/sleep',
  Health: '/health',
  Insights: '/insights',
  Profile: '/profile',
  Notifications: '/notifications',
  Streak: '/streak',
}

export function screenFromPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  return Object.entries(screenPaths).find(([, path]) => path === normalized)?.[0] ?? 'Home'
}
