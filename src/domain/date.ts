import type { ISODate } from './types'

export function toISODate(date: Date): ISODate {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}` as ISODate
}

export function formatToday(date = new Date()): string {
  return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(date)
}

/** Parse an ISO calendar key as local midnight; never route date-only values through UTC. */
export function dateFromISO(date: ISODate): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Return the previous local calendar date without routing a date-only key through UTC. */
export function previousLocalDate(date: ISODate): ISODate {
  const previous = dateFromISO(date)
  previous.setDate(previous.getDate() - 1)
  return toISODate(previous)
}

export function formatISODate(date: ISODate): string {
  return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(dateFromISO(date))
}
