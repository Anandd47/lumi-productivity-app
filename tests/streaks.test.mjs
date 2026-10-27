import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { openDB } from 'idb'
import { upgradeLumiDatabase } from '../src/data/database.ts'
import { dateFromISO, previousLocalDate, toISODate } from '../src/domain/date.ts'
import { calculateStreakStats, completedCoreCount, qualifiesForStreak } from '../src/features/streaks/streak.ts'
import { buildStreakMonth } from '../src/features/streaks/history.ts'
import { loadStreakHistory, removeGraceDay, useGraceDay } from '../src/features/streaks/repository.ts'

let database
let databaseName
const blankLog = (date, completedHabitIds = [], completedTaskIds = []) => ({ date, completedHabitIds, completedTaskIds, focusMinutes: 0, studyMinutes: 0, healthChecks: 0, completedPriorityIds: [] })
const habits = [
  { id: 'read', name: 'Read', icon: 'book', color: 'orange', targetPerWeek: 7, kind: 'core', createdAt: '2024-01-01' },
  { id: 'walk', name: 'Walk', icon: 'shoe', color: 'violet', targetPerWeek: 7, kind: 'core', createdAt: '2024-01-01' },
  { id: 'stretch', name: 'Stretch', icon: 'sparkle', color: 'blue', targetPerWeek: 7, kind: 'optional', createdAt: '2024-01-01' },
]

function qualifyingLog(date) { return blankLog(date, ['read', 'walk']) }
function localDateAfter(date, days) {
  const local = dateFromISO(date)
  local.setDate(local.getDate() + days)
  return toISODate(local)
}
async function openCurrentDatabase(name) {
  return openDB(name, 6, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      void upgradeLumiDatabase(db, oldVersion, transaction).catch(() => transaction.abort())
    },
  })
}
async function deleteTestDatabase(name) {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = resolve
    request.onerror = () => reject(request.error)
  })
}

describe('streak calendar history', () => {
  it('builds a Monday-first month with completed, grace, missed, today, future, and untracked states', () => {
    const days = buildStreakMonth('2026-10-25', ['2026-10-24'], ['2026-10-22'], habits)
    assert.equal(days.length, 35)
    assert.equal(days[0].date, '2026-09-28')
    assert.equal(days[0].state, 'outside')
    assert.equal(days.find((day) => day.date === '2026-10-24').state, 'completed')
    assert.equal(days.find((day) => day.date === '2026-10-22').state, 'grace')
    assert.equal(days.find((day) => day.date === '2026-10-23').state, 'missed')
    assert.equal(days.find((day) => day.date === '2026-10-25').state, 'today')
    assert.equal(days.find((day) => day.date === '2026-10-26').state, 'future')
    const noActiveHabits = habits.map((habit) => ({ ...habit, createdAt: '2026-10-26' }))
    assert.equal(buildStreakMonth('2026-10-25', [], [], noActiveHabits).find((day) => day.date === '2026-10-24').state, 'untracked')
  })
})

beforeEach(async () => {
  databaseName = `lumi-streak-test-${crypto.randomUUID()}`
  database = await openCurrentDatabase(databaseName)
})
afterEach(async () => {
  database.close()
  await deleteTestDatabase(databaseName)
})

describe('real streak calculation', () => {
  it('qualifies only days with two or more completed active core habits', () => {
    assert.equal(completedCoreCount(habits, blankLog('2025-04-01', ['read', 'walk', 'stretch']), '2025-04-01'), 2)
    assert.equal(qualifiesForStreak(habits, blankLog('2025-04-01', ['read', 'stretch']), '2025-04-01'), false)
    assert.equal(qualifiesForStreak(habits, blankLog('2025-04-01', ['read', 'walk']), '2025-04-01'), true)
    const archived = [{ ...habits[1], archivedAt: '2025-04-01' }]
    assert.equal(qualifiesForStreak([habits[0], archived[0]], blankLog('2025-04-01', ['read', 'walk']), '2025-04-01'), false)
  })

  it('derives current and longest streak from consecutive local dates', () => {
    const logs = ['2025-04-08', '2025-04-09', '2025-04-10'].map(qualifyingLog)
    const stats = calculateStreakStats(habits, logs, [], '2025-04-10')
    assert.equal(stats.currentStreak, 3)
    assert.equal(stats.longestStreak, 3)
    assert.equal(stats.currentMonthQualifyingDays, 3)
  })

  it('breaks a chain on an unprotected missed day and bridges exactly one saved grace day without counting it', () => {
    const logs = ['2025-04-08', '2025-04-10'].map(qualifyingLog)
    assert.equal(calculateStreakStats(habits, logs, [], '2025-04-10').currentStreak, 1)
    const withGrace = calculateStreakStats(habits, logs, [{ month: '2025-04', usedOn: '2025-04-09' }], '2025-04-10')
    assert.equal(withGrace.currentStreak, 2)
    assert.equal(withGrace.longestStreak, 2)
    assert.equal(withGrace.currentMonthQualifyingDays, 2)
  })

  it('keeps streaks continuous across month and year boundaries using local date arithmetic', () => {
    const logs = ['2024-12-30', '2025-01-01'].map(qualifyingLog)
    const stats = calculateStreakStats(habits, logs, [{ month: '2024-12', usedOn: '2024-12-31' }], '2025-01-01')
    assert.equal(stats.currentStreak, 2)
    assert.equal(stats.longestStreak, 2)
    assert.equal(previousLocalDate('2025-01-01'), '2024-12-31')
    const localMidnight = new Date(2025, 0, 1, 0, 5)
    assert.equal(toISODate(localMidnight), '2025-01-01')
    assert.equal(toISODate(dateFromISO('2025-01-01')), '2025-01-01')
  })

  it('calculates longest streak and the 7, 14, 30 and 100 day milestones', () => {
    const first = '2024-01-01'
    const logs = Array.from({ length: 100 }, (_, index) => qualifyingLog(localDateAfter(first, index)))
    const stats = calculateStreakStats(habits, logs, [], localDateAfter(first, 99))
    assert.equal(stats.currentStreak, 100)
    assert.equal(stats.longestStreak, 100)
    assert.deepEqual(stats.reachedMilestones, [7, 14, 30, 100])
    assert.equal(stats.milestoneMessage, 'New longest streak: 100 qualifying days.')
  })

  it('recalculates historical chains after a completion is edited or deleted', () => {
    const logs = ['2025-04-08', '2025-04-09', '2025-04-10'].map(qualifyingLog)
    assert.equal(calculateStreakStats(habits, logs, [], '2025-04-10').longestStreak, 3)
    const edited = logs.map((log) => log.date === '2025-04-09' ? { ...log, completedHabitIds: ['read'] } : log)
    assert.equal(calculateStreakStats(habits, edited, [], '2025-04-10').longestStreak, 1)
    const deleted = logs.filter((log) => log.date !== '2025-04-09')
    assert.equal(calculateStreakStats(habits, deleted, [], '2025-04-10').longestStreak, 1)
  })

  it('requires two configured core habits and never substitutes completed tasks', () => {
    const oneCore = [habits[0], habits[2]]
    const logs = [blankLog('2025-04-10', ['read', 'stretch'], ['task-1', 'task-2'])]
    const stats = calculateStreakStats(oneCore, logs, [], '2025-04-10')
    assert.equal(stats.configured, false)
    assert.equal(stats.currentStreak, 0)
    assert.equal(stats.longestStreak, 0)
    assert.equal(qualifiesForStreak(oneCore, logs[0], '2025-04-10'), false)
  })
})

describe('monthly grace day storage', () => {
  it('persists one grace day per month, rejects qualifying/future/out-of-gap dates, and frees usage when undone', async () => {
    for (const date of ['2025-03-01', '2025-03-03', '2025-03-05', '2025-03-07']) {
      await database.put('dailyLogs', qualifyingLog(date))
    }
    await database.put('habits', habits[0]); await database.put('habits', habits[1])
    await assert.rejects(useGraceDay('2025-03-09', database, new Date(2025, 2, 10, 12)), /bridge one missed date/)
    const used = await useGraceDay('2025-03-02', database, new Date(2025, 2, 10, 12))
    assert.deepEqual(used, { month: '2025-03', usedOn: '2025-03-02' })
    assert.deepEqual((await loadStreakHistory(database)).graceDays, [used])
    await assert.rejects(useGraceDay('2025-03-04', database, new Date(2025, 3, 10, 12)), /do not roll over/)
    await assert.rejects(useGraceDay('2025-03-04', database, new Date(2025, 2, 10, 12)), /already used/)
    await assert.rejects(useGraceDay('2025-03-03', database, new Date(2025, 2, 10, 12)), /already used/)
    await assert.rejects(useGraceDay('2025-03-10', database, new Date(2025, 2, 10, 12)), /already passed/)
    await removeGraceDay('2025-03', database)
    await useGraceDay('2025-03-04', database, new Date(2025, 2, 10, 12))
    await database.put('dailyLogs', qualifyingLog('2025-04-05'))
    await database.put('dailyLogs', qualifyingLog('2025-04-07'))
    await useGraceDay('2025-04-06', database, new Date(2025, 3, 10, 12))
    assert.deepEqual((await loadStreakHistory(database)).graceDays.map((item) => item.month).sort(), ['2025-03', '2025-04'])
  })
})
