import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { openDB } from 'idb'
import { upgradeLumiDatabase } from '../src/data/database.ts'
import { calculateCoreProgress } from '../src/features/habits/progress.ts'
import { createHabit, deleteHabit, getDailyLog, listHabits, setHabitCompletion, updateHabit } from '../src/features/habits/repository.ts'

const today = '2025-04-10'
const anotherDay = '2025-04-11'
let database
let databaseName

const coreHabit = { name: ' Read 20 minutes ', kind: 'core', icon: '📖', color: 'orange', targetPerWeek: 5 }

async function openCurrentDatabase(name) {
  return openDB(name, 6, {
    upgrade: (db, oldVersion, _newVersion, transaction) => {
      void upgradeLumiDatabase(db, oldVersion, transaction).catch(() => transaction.abort())
    },
  })
}

beforeEach(async () => {
  databaseName = `lumi-test-${crypto.randomUUID()}`
  database = await openCurrentDatabase(databaseName)
})

afterEach(async () => {
  database.close()
  await deleteTestDatabase(databaseName)
})

async function deleteTestDatabase(name) {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = resolve
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Test database deletion was blocked.'))
  })
}

describe('habit repository', () => {
  it('creates validated habits and edits them without changing identity or creation date', async () => {
    const created = await createHabit(coreHabit, database, new Date(2025, 3, 10, 18))
    assert.equal(created.name, 'Read 20 minutes')
    assert.equal(created.createdAt, today)
    assert.equal(created.kind, 'core')
    assert.equal(created.icon, '📖', 'legacy habit icons remain valid')

    const updated = await updateHabit(created.id, { ...coreHabit, name: 'Evening reading', icon: 'book-open', targetPerWeek: 4 }, database)
    assert.equal(updated.id, created.id)
    assert.equal(updated.createdAt, today)
    assert.equal(updated.name, 'Evening reading')
    assert.equal(updated.targetPerWeek, 4)
    assert.equal(updated.icon, 'book-open')
  })

  it('rejects blank names and invalid weekly targets', async () => {
    await assert.rejects(createHabit({ ...coreHabit, name: '   ' }, database), /Give your habit a name/)
    await assert.rejects(createHabit({ ...coreHabit, targetPerWeek: 8 }, database), /Choose a weekly target/)
    assert.equal((await listHabits(database)).length, 0)
  })

  it('stores completion by local date, supports unchecking, and persists after reopening the database', async () => {
    const habit = await createHabit(coreHabit, database, new Date(2025, 3, 1))
    await setHabitCompletion(today, habit.id, true, database)
    assert.deepEqual((await getDailyLog(today, database)).completedHabitIds, [habit.id])
    assert.deepEqual((await getDailyLog(anotherDay, database)).completedHabitIds, [])

    database.close()
    database = await openCurrentDatabase(databaseName)
    assert.deepEqual((await listHabits(database)).map((saved) => saved.id), [habit.id])
    assert.deepEqual((await getDailyLog(today, database)).completedHabitIds, [habit.id])

    await setHabitCompletion(today, habit.id, false, database)
    assert.deepEqual((await getDailyLog(today, database)).completedHabitIds, [])
  })

  it('deletes a habit and removes its dated completion references', async () => {
    const habit = await createHabit(coreHabit, database, new Date(2025, 3, 1))
    await setHabitCompletion(today, habit.id, true, database)
    await setHabitCompletion(anotherDay, habit.id, true, database)

    await deleteHabit(habit.id, database)
    assert.deepEqual(await listHabits(database), [])
    assert.deepEqual((await getDailyLog(today, database)).completedHabitIds, [])
    assert.deepEqual((await getDailyLog(anotherDay, database)).completedHabitIds, [])
  })

  it('counts core habits in Daily Orb progress and tracks optional habits outside it', async () => {
    const core = await createHabit(coreHabit, database, new Date(2025, 3, 1))
    const optional = await createHabit({ ...coreHabit, name: 'Stretch', kind: 'optional', color: 'violet' }, database, new Date(2025, 3, 1))
    assert.deepEqual(calculateCoreProgress([core, optional], [optional.id], today), {
      activeCoreCount: 1, completedCoreCount: 0, percentage: 0, isEmpty: false,
    })
    assert.deepEqual(calculateCoreProgress([core, optional], [core.id, optional.id], today), {
      activeCoreCount: 1, completedCoreCount: 1, percentage: 100, isEmpty: false,
    })
  })

  it('returns an explicit empty progress state when there are no active core habits', async () => {
    const optional = await createHabit({ ...coreHabit, name: 'Stretch', kind: 'optional' }, database, new Date(2025, 3, 1))
    assert.deepEqual(calculateCoreProgress([optional], [optional.id], today), {
      activeCoreCount: 0, completedCoreCount: 0, percentage: 0, isEmpty: true,
    })
  })

  it('migrates Phase 1 habits to core when upgrading the existing database', async () => {
    database.close()
    await deleteTestDatabase(databaseName)
    databaseName = `lumi-migration-test-${crypto.randomUUID()}`
    const oldHabit = { id: 'legacy', name: 'Drink water', icon: '💧', color: 'blue', targetPerWeek: 7, createdAt: today }
    const versionOne = await openDB(databaseName, 1, {
      upgrade(db) {
        const habits = db.createObjectStore('habits', { keyPath: 'id' })
        habits.createIndex('by-created', 'createdAt')
        db.createObjectStore('dailyLogs', { keyPath: 'date' })
        db.createObjectStore('graceDays', { keyPath: 'month' })
      },
    })
    await versionOne.put('habits', oldHabit)
    versionOne.close()

    database = await openCurrentDatabase(databaseName)
    assert.equal((await database.get('habits', 'legacy')).kind, 'core')
  })
})

describe('dated tasks and task progress', () => {
  it('creates, validates, edits, deletes and persists task records with date-specific completion', async () => {
    const { createTask, deleteTask, listTasks, setTaskCompletion, updateTask } = await import('../src/features/tasks/repository.ts')
    const { calculateTaskProgress } = await import('../src/features/tasks/progress.ts')
    const task = await createTask({ title: ' Study block ', time: '10:00', date: today, icon: 'book-open' }, database)
    assert.equal(task.title, 'Study block')
    assert.equal(task.icon, 'book-open')
    assert.equal((await listTasks(today, database)).length, 1)
    await assert.rejects(createTask({ title: '  ', time: '10:00', date: today }, database), /Give your task a name/)
    const edited = await updateTask(task.id, { title: 'Read notes', time: '11:00', date: today }, database)
    assert.equal(edited.id, task.id)
    assert.equal(edited.icon, 'book-open', 'editing other task fields preserves its icon')
    const noIconTask = await createTask({ title: 'Quick errand', time: '12:00', date: today }, database)
    assert.equal(noIconTask.icon, undefined)
    await deleteTask(noIconTask.id, database)
    const cleared = await updateTask(task.id, { title: 'Read notes', time: '11:00', date: today, icon: null }, database)
    assert.equal(cleared.icon, undefined, 'None removes the optional icon')
    await updateTask(task.id, { title: 'Read notes', time: '11:00', date: today, icon: 'graduation-cap' }, database)
    await setTaskCompletion(today, task.id, true, database)
    assert.deepEqual((await getDailyLog(today, database)).completedTaskIds, [task.id])
    assert.deepEqual((await getDailyLog(anotherDay, database)).completedTaskIds, [])
    const savedTasks = await listTasks(today, database)
    const savedDone = (await getDailyLog(today, database)).completedTaskIds
    const progress = calculateTaskProgress(savedTasks, savedDone)
    assert.deepEqual({ completed: progress.completedCount, total: progress.totalCount, percentage: progress.percentage }, { completed: 1, total: 1, percentage: 100 })
    database.close(); database = await openCurrentDatabase(databaseName)
    assert.equal((await listTasks(today, database))[0].title, 'Read notes')
    assert.equal((await listTasks(today, database))[0].icon, 'graduation-cap')
    assert.deepEqual((await getDailyLog(today, database)).completedTaskIds, [task.id])
    await setTaskCompletion(today, task.id, false, database)
    assert.deepEqual((await getDailyLog(today, database)).completedTaskIds, [])
    await deleteTask(task.id, database)
    assert.deepEqual(await listTasks(today, database), [])
  })

  it('calculates rounded task progress and returns zero for no tasks', async () => {
    const { calculateTaskProgress } = await import('../src/features/tasks/progress.ts')
    const tasks = [1, 2, 3, 4, 5].map((n) => ({ id: `${n}`, title: `${n}`, time: '09:00', date: today }))
    assert.deepEqual(calculateTaskProgress(tasks, ['1', '2', '3']), { totalCount: 5, completedCount: 3, percentage: 60 })
    assert.deepEqual(calculateTaskProgress([], []), { totalCount: 0, completedCount: 0, percentage: 0 })
  })

  it('keeps habit completion and optional routines independent from task progress', async () => {
    const { calculateTaskProgress } = await import('../src/features/tasks/progress.ts')
    const habit = await createHabit({ ...coreHabit, name: 'Stretch', kind: 'optional' }, database, new Date(2025, 3, 1))
    await setHabitCompletion(today, habit.id, true, database)
    assert.deepEqual((await getDailyLog(today, database)).completedTaskIds, [])
    assert.equal(calculateTaskProgress([], (await getDailyLog(today, database)).completedHabitIds).percentage, 0)
  })
})

describe('focus timer and study tracking', () => {
  it('defaults the daily study target to six hours and preserves settings', async () => {
    const { DEFAULT_STUDY_TARGET_SECONDS, getSettings, setStudyTargetSeconds } = await import('../src/features/focus/repository.ts')
    assert.equal((await getSettings(database)).studyTargetSeconds, 21600)
    assert.equal(DEFAULT_STUDY_TARGET_SECONDS, 21600)
    await setStudyTargetSeconds(5 * 3600, database)
    assert.equal((await getSettings(database)).studyTargetSeconds, 18000)
  })

  it('persists timer configuration and atomically records a dated session with timer state', async () => {
    const { commitTimerTransition, createDefaultTimerState, getTimerState, listFocusSessions } = await import('../src/features/focus/repository.ts')
    const startedAt = Date.now()
    const state = { ...createDefaultTimerState(), kind: 'countdown', status: 'running', subject: 'Chemistry', countdownSeconds: 1800, remainingSeconds: 1800, startedAt, sessionStartedAt: startedAt, endsAt: startedAt + 1800 * 1000 }
    await commitTimerTransition(state, { date: today, subject: 'Chemistry', startedAt: Date.parse('2025-04-10T10:00:00'), endedAt: Date.parse('2025-04-10T10:25:00'), durationSeconds: 1500, kind: 'countdown' }, database)
    database.close(); database = await openCurrentDatabase(databaseName)
    const savedTimer = await getTimerState(database)
    assert.equal(savedTimer.countdownSeconds, 1800)
    assert.equal(savedTimer.status, 'running')
    assert.ok(savedTimer.endsAt > Date.now())
    const sessions = await listFocusSessions(today, database)
    assert.equal(sessions.length, 1)
    assert.equal(sessions[0].subject, 'Chemistry')
    assert.equal(sessions[0].durationSeconds, 1500)
  })

  it('aggregates actual study time by subject and caps target progress', async () => {
    const { summarizeStudy, formatDuration } = await import('../src/features/focus/progress.ts')
    const sessions = [
      { id: '1', date: today, subject: 'Math', startedAt: 1, endedAt: 3601, durationSeconds: 3600, kind: 'pomodoro' },
      { id: '2', date: today, subject: 'Math', startedAt: 2, endedAt: 1802, durationSeconds: 1800, kind: 'stopwatch' },
      { id: '3', date: today, subject: 'Art', startedAt: 3, endedAt: 903, durationSeconds: 900, kind: 'countdown' },
    ]
    const summary = summarizeStudy(sessions, 6 * 3600)
    assert.equal(summary.totalSeconds, 6300)
    assert.equal(summary.percent, 29)
    assert.deepEqual(summary.subjects, [{ subject: 'Math', seconds: 5400 }, { subject: 'Art', seconds: 900 }])
    assert.equal(formatDuration(21600), '6h 00m')
  })

  it('calculates resumable countdown and stopwatch elapsed time from timestamps', async () => {
    const { createDefaultTimerState } = await import('../src/features/focus/repository.ts')
    const { remainingTimerSeconds, elapsedTimerSeconds } = await import('../src/features/focus/timer.ts')
    const started = 100000
    const countdown = { ...createDefaultTimerState(started), status: 'running', startedAt: started, sessionStartedAt: started, remainingSeconds: 1500, endsAt: started + 1500 * 1000 }
    assert.equal(remainingTimerSeconds(countdown, started + 60 * 1000), 1440)
    assert.equal(elapsedTimerSeconds(countdown, started + 60 * 1000), 60)
    const pausedCountdown = { ...countdown, status: 'paused', remainingSeconds: 1400, startedAt: null, endsAt: null }
    assert.equal(elapsedTimerSeconds(pausedCountdown, started + 20 * 60 * 1000), 100)
    const stopwatch = { ...countdown, kind: 'stopwatch', endsAt: null, accumulatedSeconds: 120, startedAt: started }
    assert.equal(elapsedTimerSeconds(stopwatch, started + 30 * 1000), 150)
  })

  it('resets or discards only the active timer state without adding or deleting saved sessions', async () => {
    const { commitTimerTransition, createDefaultTimerState, listFocusSessions } = await import('../src/features/focus/repository.ts')
    const { resetTimerState, discardTimerState } = await import('../src/features/focus/timer.ts')
    const prior = { date: today, subject: 'Existing entry', startedAt: 1000, endedAt: 61000, durationSeconds: 60, kind: 'stopwatch' }
    await commitTimerTransition(createDefaultTimerState(), prior, database)
    const running = { ...createDefaultTimerState(), status: 'running', startedAt: 1000, sessionStartedAt: 1000, endsAt: 61000 }
    const reset = resetTimerState(running, 2000)
    assert.equal(reset.status, 'paused')
    assert.equal(reset.remainingSeconds, reset.focusSeconds)
    assert.equal(reset.sessionStartedAt, null)
    await commitTimerTransition(reset, undefined, database)
    const discarded = discardTimerState(running, 3000)
    assert.equal(discarded.status, 'idle')
    assert.equal(discarded.endsAt, null)
    await commitTimerTransition(discarded, undefined, database)
    assert.equal((await listFocusSessions(today, database)).length, 1)
  })

  it('deletes one accidentally saved study entry without affecting other history', async () => {
    const { deleteFocusSession, listFocusSessions, recordFocusSession } = await import('../src/features/focus/repository.ts')
    const { summarizeStudy } = await import('../src/features/focus/progress.ts')
    const first = await recordFocusSession({ date: today, subject: 'Math', startedAt: 1, endedAt: 61, durationSeconds: 60, kind: 'stopwatch' }, database)
    await recordFocusSession({ date: today, subject: 'Biology', startedAt: 2, endedAt: 122, durationSeconds: 120, kind: 'countdown' }, database)
    await deleteFocusSession(first.id, database)
    const remaining = await listFocusSessions(today, database)
    assert.equal(remaining.length, 1)
    assert.equal(remaining[0].subject, 'Biology')
    assert.equal(summarizeStudy(remaining, 21600).totalSeconds, 120)
  })
})
