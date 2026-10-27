import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { openDB } from 'idb'
import { upgradeLumiDatabase } from '../src/data/database.ts'
import { activityMinutes, waterProgress } from '../src/features/health/progress.ts'
import { createActivityEntry, createWaterEntry, deleteActivityEntry, deleteWaterEntry, listActivityEntries, listWaterEntries, setWaterGoalGlasses, updateActivityEntry, updateWaterEntry } from '../src/features/health/repository.ts'

let db
let name
async function openCurrent() { return openDB(name, 6, { upgrade: (database, oldVersion, _version, transaction) => { void upgradeLumiDatabase(database, oldVersion, transaction).catch(() => transaction.abort()) } }) }
beforeEach(async () => { name = `lumi-health-${crypto.randomUUID()}`; db = await openCurrent() })
afterEach(async () => { db.close(); await new Promise((resolve, reject) => { const request = indexedDB.deleteDatabase(name); request.onsuccess = resolve; request.onerror = () => reject(request.error) }) })

describe('health tracking', () => {
  it('calculates water goal progress from entries on the selected local date only', async () => {
    const today = '2026-10-21'
    const one = await createWaterEntry({ date: today, glasses: 3 }, db)
    await createWaterEntry({ date: '2026-10-20', glasses: 5 }, db)
    await createWaterEntry({ date: today, glasses: 2 }, db)
    assert.deepEqual(waterProgress([one, ...(await listWaterEntries(db)).filter((entry) => entry.id !== one.id)], today, 8), { glasses: 5, goalGlasses: 8, percent: 63 })
    assert.deepEqual(waterProgress([], today, 8), { glasses: 0, goalGlasses: 8, percent: 0 })
  })

  it('validates health dates, water amounts, activity type, and duration', async () => {
    await assert.rejects(createWaterEntry({ date: '2026-02-30', glasses: 1 }, db), /valid local date/)
    await assert.rejects(createWaterEntry({ date: '2026-10-21', glasses: 0 }, db), /whole number/)
    await assert.rejects(createActivityEntry({ date: '2026-10-21', type: 'Rest' , durationMinutes: 20 }, db), /valid activity type/)
    await assert.rejects(createActivityEntry({ date: '2026-10-21', type: 'Walking', durationMinutes: 0 }, db), /duration/)
  })

  it('adds only selected-date activity minutes and persists edited water and activity entries', async () => {
    const water = await createWaterEntry({ date: '2026-10-21', glasses: 2 }, db)
    const walk = await createActivityEntry({ date: '2026-10-21', type: 'Walking', durationMinutes: 25 }, db)
    await createActivityEntry({ date: '2026-10-20', type: 'Yoga', durationMinutes: 40 }, db)
    assert.equal(activityMinutes(await listActivityEntries(db), '2026-10-21'), 25)
    await updateWaterEntry(water.id, { date: '2026-10-20', glasses: 4 }, db)
    await updateActivityEntry(walk.id, { date: '2026-10-21', type: 'Running', durationMinutes: 35 }, db)
    db.close(); db = await openCurrent()
    assert.deepEqual((await listWaterEntries(db)).map(({ date, glasses }) => [date, glasses]), [['2026-10-20', 4]])
    assert.equal((await listActivityEntries(db)).find((entry) => entry.id === walk.id).durationMinutes, 35)
  })

  it('deletes water and activity entries independently', async () => {
    const water = await createWaterEntry({ date: '2026-10-21', glasses: 1 }, db)
    const activity = await createActivityEntry({ date: '2026-10-21', type: 'Cycling', durationMinutes: 20 }, db)
    await deleteWaterEntry(water.id, db); await deleteActivityEntry(activity.id, db)
    assert.deepEqual(await listWaterEntries(db), [])
    assert.deepEqual(await listActivityEntries(db), [])
  })

  it('persists a configurable water goal and defaults settings to eight glasses', async () => {
    const settings = await setWaterGoalGlasses(10, db)
    assert.equal(settings.waterGoalGlasses, 10)
    db.close(); db = await openCurrent()
    assert.equal((await db.get('settings', 'settings')).waterGoalGlasses, 10)
  })

  it('adds the eight-glass goal when upgrading existing Phase 5 settings', async () => {
    db.close()
    await new Promise((resolve, reject) => { const request = indexedDB.deleteDatabase(name); request.onsuccess = resolve; request.onerror = () => reject(request.error) })
    const versionFive = await openDB(name, 5, { upgrade(database) {
      database.createObjectStore('habits', { keyPath: 'id' }).createIndex('by-created', 'createdAt')
      database.createObjectStore('dailyLogs', { keyPath: 'date' })
      database.createObjectStore('graceDays', { keyPath: 'month' })
      database.createObjectStore('tasks', { keyPath: 'id' }).createIndex('by-date', 'date')
      database.createObjectStore('focusSessions', { keyPath: 'id' }).createIndex('by-date', 'date')
      database.createObjectStore('timerState', { keyPath: 'id' })
      database.createObjectStore('settings', { keyPath: 'id' })
      database.createObjectStore('sleepRecords', { keyPath: 'id' }).createIndex('by-date', 'date')
    } })
    await versionFive.put('settings', { id: 'settings', studyTargetSeconds: 21600, sleepTargetMinutes: 480 })
    versionFive.close(); db = await openCurrent()
    assert.equal((await db.get('settings', 'settings')).waterGoalGlasses, 8)
    assert.equal(db.objectStoreNames.contains('waterEntries'), true)
    assert.equal(db.objectStoreNames.contains('activityEntries'), true)
  })
})
