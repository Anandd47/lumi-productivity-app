import { dateFromISO, toISODate } from '../../domain/date.ts'
import type { ISODate, SleepRecord } from '../../domain/types'

export function calculateSleepProgress(record: SleepRecord | undefined, goalMinutes: number) {
  const durationMinutes = record?.durationMinutes ?? 0
  return { durationMinutes, goalMinutes, percent: goalMinutes > 0 ? Math.min(100, Math.round(durationMinutes / goalMinutes * 100)) : 0 }
}

export function summarizeSleepWeek(records: SleepRecord[], referenceDate: ISODate, goalMinutes: number) {
  const reference = dateFromISO(referenceDate)
  const weekStartDate = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())
  weekStartDate.setDate(weekStartDate.getDate() - ((weekStartDate.getDay() + 6) % 7))
  const weekEndDate = new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate() + 6)
  const weekStart = toISODate(weekStartDate)
  const weekEnd = toISODate(weekEndDate)
  const weekRecords = records.filter((record) => record.date >= weekStart && record.date <= weekEnd)
  const totalMinutes = weekRecords.reduce((total, record) => total + record.durationMinutes, 0)
  return {
    weekStart,
    weekEnd,
    totalMinutes,
    loggedNights: weekRecords.length,
    averageMinutes: weekRecords.length ? Math.round(totalMinutes / weekRecords.length) : 0,
    goalMetNights: weekRecords.filter((record) => record.durationMinutes >= goalMinutes).length,
  }
}
