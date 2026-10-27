import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { openDB } from 'idb'
import { upgradeLumiDatabase } from '../src/data/database.ts'
import { calculateSleepProgress, summarizeSleepWeek } from '../src/features/sleep/progress.ts'
import { createSleepRecord, deleteSleepRecord, listSleepRecords, setSleepTargetMinutes, updateSleepRecord } from '../src/features/sleep/repository.ts'

let db
let name

async function openCurrent() {
  return openDB(name, 6, { upgrade: (database, oldVersion, _version, transaction) => {
    void upgradeLumiDatabase(database, oldVersion, transaction).catch(() => transaction.abort())
  } })
}

beforeEach(async () => { name = `lumi-sleep-${crypto.randomUUID()}`; db = await openCurrent() })
afterEach(async () => {
  db.close()
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = resolve
    request.onerror = () => reject(request.error)
  })
})

describe('sleep tracking', () => {
  it('calculates an overnight sleep period against the local wake date', async () => {
    const record = await createSleepRecord({ date: '2025-04-10', startTime: '22:30', wakeTime: '06:30' }, db)
    assert.equal(record.durationMinutes, 480)
    assert.equal(new Date(record.startedAt).getDate(), 9)
    assert.equal(new Date(record.endedAt).getDate(), 10)
  })

  it('rejects invalid dates, malformed times, and zero duration', async () => {
    await assert.rejects(createSleepRecord({ date: '2025-02-30', startTime: '22:00', wakeTime: '06:00' }, db), /valid wake-up date/)
    await assert.rejects(createSleepRecord({ date: '2025-04-10', startTime: '25:00', wakeTime: '06:00' }, db), /valid sleep/)
    await assert.rejects(createSleepRecord({ date: '2025-04-10', startTime: '06:00', wakeTime: '06:00' }, db), /later than sleep start/)
  })

  it('supports editing, deletion, and persistence after reopening IndexedDB', async () => {
    const created = await createSleepRecord({ date: '2025-04-10', startTime: '23:00', wakeTime: '07:00' }, db)
    const edited = await updateSleepRecord(created.id, { date: '2025-04-10', startTime: '22:00', wakeTime: '07:00' }, db)
    assert.equal(edited.durationMinutes, 540)
    db.close()
    db = await openCurrent()
    assert.equal((await listSleepRecords(db))[0].durationMinutes, 540)
    await deleteSleepRecord(created.id, db)
    assert.deepEqual(await listSleepRecords(db), [])
  })

  it('prevents duplicate wake dates and overlapping records', async () => {
    await createSleepRecord({ date: '2025-04-10', startTime: '18:00', wakeTime: '23:00' }, db)
    await assert.rejects(createSleepRecord({ date: '2025-04-10', startTime: '19:00', wakeTime: '23:30' }, db), /already exists/)
    await assert.rejects(createSleepRecord({ date: '2025-04-11', startTime: '22:00', wakeTime: '06:00' }, db), /overlaps/)
  })

  it('persists the configurable goal and calculates progress and Monday-based weekly totals', async () => {
    const goal = await setSleepTargetMinutes(450, db)
    assert.equal(goal.sleepTargetMinutes, 450)
    const record = await createSleepRecord({ date: '2025-04-10', startTime: '22:00', wakeTime: '06:00' }, db)
    assert.deepEqual(calculateSleepProgress(record, 450), { durationMinutes: 480, goalMinutes: 450, percent: 100 })
    assert.deepEqual(calculateSleepProgress(undefined, 450), { durationMinutes: 0, goalMinutes: 450, percent: 0 })
    const summary = summarizeSleepWeek([record], '2025-04-10', 450)
    assert.equal(summary.totalMinutes, 480)
    assert.equal(summary.loggedNights, 1)
    assert.equal(summary.goalMetNights, 1)
    assert.equal(summary.weekStart, '2025-04-07')
    assert.equal(summary.weekEnd, '2025-04-13')
    db.close()
    db = await openCurrent()
    assert.equal((await db.get('settings', 'settings')).sleepTargetMinutes, 450)
  })

  it('adds the default sleep goal when upgrading an existing Phase 4 settings record', async () => {
    db.close()
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = resolve
      request.onerror = () => reject(request.error)
    })
    const versionFour = await openDB(name, 4, { upgrade(database) {
      database.createObjectStore('habits', { keyPath: 'id' }).createIndex('by-created', 'createdAt')
      database.createObjectStore('dailyLogs', { keyPath: 'date' })
      database.createObjectStore('graceDays', { keyPath: 'month' })
      database.createObjectStore('tasks', { keyPath: 'id' }).createIndex('by-date', 'date')
      database.createObjectStore('focusSessions', { keyPath: 'id' }).createIndex('by-date', 'date')
      database.createObjectStore('timerState', { keyPath: 'id' })
      database.createObjectStore('settings', { keyPath: 'id' })
    } })
    await versionFour.put('settings', { id: 'settings', studyTargetSeconds: 21600 })
    versionFour.close()
    db = await openCurrent()
    assert.equal((await db.get('settings', 'settings')).sleepTargetMinutes, 480)
  })
})
