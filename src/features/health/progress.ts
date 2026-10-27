import type { ActivityEntry, ISODate, WaterEntry } from '../../domain/types'

export function waterProgress(entries: WaterEntry[], date: ISODate, goalGlasses: number) {
  const glasses = entries.filter((entry) => entry.date === date).reduce((sum, entry) => sum + entry.glasses, 0)
  return { glasses, goalGlasses, percent: goalGlasses > 0 ? Math.min(100, Math.round(glasses / goalGlasses * 100)) : 0 }
}

export function activityMinutes(entries: ActivityEntry[], date: ISODate) {
  return entries.filter((entry) => entry.date === date).reduce((sum, entry) => sum + entry.durationMinutes, 0)
}
