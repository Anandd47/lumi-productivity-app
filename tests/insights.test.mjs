import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { previousLocalDate, toISODate } from '../src/domain/date.ts'
import { calculateStudyAnalytics, compareStudyDays } from '../src/features/insights/analytics.ts'
import { activityOnDate, buildStudyHeatmap, getMonthGrid, shiftISODateMonth, studyIntensity } from '../src/features/insights/calendar.ts'
import { getSelectedDayData } from '../src/features/insights/repository.ts'

function session(date, durationSeconds, subject = 'Math', startedAt = new Date(`${date}T12:00:00`).getTime()) {
  return { id: `${date}-${subject}-${startedAt}`, date, subject, startedAt, endedAt: startedAt + durationSeconds * 1000, durationSeconds, kind: 'pomodoro' }
}

describe('monthly calendar helpers', () => {
  it('builds a Monday-first month grid with complete calendar weeks', () => {
    const dates = getMonthGrid(new Date(2026, 1, 1))
    assert.equal(dates.length % 7, 0)
    assert.equal(toISODate(dates[0]), '2026-01-26')
    assert.equal(dates[0].getDay(), 1)
    assert.equal(toISODate(dates[dates.length - 1]), '2026-03-01')
  })

  it('moves selected dates across months and clamps month-end dates', () => {
    assert.equal(shiftISODateMonth('2025-01-31', 1), '2025-02-28')
    assert.equal(shiftISODateMonth('2024-01-31', 1), '2024-02-29')
    assert.equal(shiftISODateMonth('2026-01-01', -1), '2025-12-01')
  })

  it('treats local calendar keys consistently around year boundaries', () => {
    const grid = getMonthGrid(new Date(2026, 0, 1))
    assert.equal(toISODate(grid.find((date) => date.getDate() === 1 && date.getMonth() === 0)), '2026-01-01')
    assert.equal(toISODate(new Date(2026, 0, 1)), '2026-01-01')
  })
})

describe('study analytics', () => {
  it('compares today with yesterday for increases, decreases, and empty days', () => {
    assert.deepEqual(compareStudyDays(90 * 60, 60 * 60), { value: '+50%', label: 'vs yesterday' })
    assert.deepEqual(compareStudyDays(30 * 60, 60 * 60), { value: '-50%', label: 'vs yesterday' })
    assert.deepEqual(compareStudyDays(0, 0), { value: 'No change yet', label: 'vs yesterday' })
    assert.deepEqual(compareStudyDays(60 * 60, 0), { value: 'Started today', label: 'vs yesterday' })
    assert.deepEqual(compareStudyDays(0, 60 * 60), { value: '-100%', label: 'vs yesterday' })
  })

  it('derives yesterday across local month and year boundaries', () => {
    assert.equal(previousLocalDate('2026-01-01'), '2025-12-31')
    assert.equal(previousLocalDate('2026-03-01'), '2026-02-28')
  })

  it('calculates week, month, average, sessions, subject totals, and target progress once from saved sessions', () => {
    const sessions = [
      session('2025-12-29', 3600, 'Math'),
      session('2025-12-31', 1800, 'Biology'),
      session('2026-01-01', 7200, 'Math'),
    ]
    const analytics = calculateStudyAnalytics(sessions, '2025-12-31', 3600)
    assert.equal(analytics.weekStart, '2025-12-29')
    assert.equal(analytics.weekEnd, '2026-01-04')
    assert.equal(analytics.weekSeconds, 12600)
    assert.equal(analytics.monthSeconds, 5400)
    assert.equal(analytics.dailyAverageSeconds, 4200)
    assert.equal(analytics.weekSessionCount, 3)
    assert.equal(analytics.selectedDateSeconds, 1800)
    assert.equal(analytics.selectedDateTargetPercent, 50)
    assert.deepEqual(analytics.subjects, [{ subject: 'Math', seconds: 3600 }, { subject: 'Biology', seconds: 1800 }])
  })

  it('returns zero values for dates with no saved focus sessions', () => {
    const analytics = calculateStudyAnalytics([], '2026-06-15', 21600)
    assert.equal(analytics.weekSeconds, 0)
    assert.equal(analytics.monthSeconds, 0)
    assert.equal(analytics.selectedDateTargetPercent, 0)
    assert.equal(analytics.weekSessionCount, 0)
    assert.deepEqual(analytics.subjects, [])
  })

  it('maps study minutes into four useful heatmap intensity levels', () => {
    assert.deepEqual([0, 1, 29, 30, 59, 60, 119, 120].map((minutes) => studyIntensity(minutes * 60)), [0, 1, 1, 2, 2, 3, 3, 4])
  })

  it('includes only real sessions within the previous 12 month window and leaves empty dates at zero', () => {
    const today = new Date(2026, 9, 21)
    const heatmap = buildStudyHeatmap([
      session('2025-10-31', 900),
      session('2025-11-01', 1800),
      session('2026-10-21', 3600),
      session('2026-10-22', 3600),
    ], today)
    assert.equal(heatmap.start, '2025-11-01')
    assert.equal(heatmap.end, '2026-10-21')
    assert.equal(heatmap.secondsByDate.has('2025-10-31'), false)
    assert.equal(heatmap.secondsByDate.get('2025-11-01'), 1800)
    assert.equal(heatmap.secondsByDate.get('2026-10-21'), 3600)
    assert.equal(heatmap.secondsByDate.has('2026-10-22'), false)
    assert.equal(heatmap.secondsByDate.get('2026-04-12') ?? 0, 0)
  })

  it('shows selected-day study, tasks, and habit records without including another date', () => {
    const selectedSession = session('2026-05-04', 1200)
    const data = {
      sessions: [selectedSession, session('2026-05-05', 3600)],
      tasks: [{ id: 't1', title: 'Read', time: '10:00', date: '2026-05-04' }, { id: 't2', title: 'Other day', time: '10:00', date: '2026-05-05' }],
      habits: [{ id: 'h1', name: 'Walk', icon: '🚶', color: 'blue', targetPerWeek: 4, kind: 'core', createdAt: '2026-01-01' }],
      dailyLogs: [{ date: '2026-05-04', completedHabitIds: ['h1'], completedTaskIds: ['t1'], focusMinutes: 0, studyMinutes: 0, healthChecks: 0, completedPriorityIds: [] }],
      settings: { id: 'settings', studyTargetSeconds: 21600 },
    }
    const selected = getSelectedDayData(data, '2026-05-04')
    assert.equal(selected.focusedSeconds, 1200)
    assert.equal(selected.sessions.length, 1)
    assert.deepEqual(selected.tasks.map(({ task, completed }) => [task.id, completed]), [['t1', true]])
    assert.deepEqual(selected.habits.map(({ habit, completed }) => [habit.id, completed]), [['h1', true]])
  })

  it('marks saved task, study, and completion activity while leaving empty dates inactive', () => {
    const sources = { studyDates: new Set(['2026-05-04']), taskDates: new Set(['2026-05-05']), completedDates: new Set(['2026-05-06']) }
    assert.equal(activityOnDate(sources, '2026-05-04'), true)
    assert.equal(activityOnDate(sources, '2026-05-05'), true)
    assert.equal(activityOnDate(sources, '2026-05-06'), true)
    assert.equal(activityOnDate(sources, '2026-05-07'), false)
  })
})
