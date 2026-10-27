import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { openDB } from 'idb'
import { upgradeLumiDatabase } from '../src/data/database.ts'
import { getSettings } from '../src/features/focus/repository.ts'
import { claimReminder, exportLumiData, getLocalDataCounts, replaceLumiData, saveNotificationPreferences, saveProfile, validateLumiBackup } from '../src/features/profile/repository.ts'
import { canSendNotification, notificationEnableAction, notificationPermissionStatus, shouldSendGoalReminder } from '../src/features/notifications/notifications.ts'

let database
let databaseName
async function openCurrent(name) {
  return openDB(name, 6, { upgrade(db, oldVersion, _newVersion, transaction) { void upgradeLumiDatabase(db, oldVersion, transaction).catch(() => transaction.abort()) } })
}
async function deleteDatabase(name) {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = resolve
    request.onerror = () => reject(request.error)
  })
}
beforeEach(async () => { databaseName = `lumi-profile-test-${crypto.randomUUID()}`; database = await openCurrent(databaseName) })
afterEach(async () => { database.close(); await deleteDatabase(databaseName) })

describe('profile settings and shared goals', () => {
  it('restores safe defaults for older or malformed saved settings', async () => {
    await database.put('settings', { id: 'settings', studyTargetSeconds: -1, sleepTargetMinutes: 0, waterGoalGlasses: 90 })
    const settings = await getSettings(database)
    assert.equal(settings.studyTargetSeconds, 21600)
    assert.equal(settings.sleepTargetMinutes, 480)
    assert.equal(settings.waterGoalGlasses, 8)
    assert.equal(settings.profile.displayName, '')
    assert.equal(settings.notifications.enabled, false)
  })

  it('persists the profile and all three goals in the shared settings record', async () => {
    const saved = await saveProfile({ displayName: '  Mira  ', avatarColor: 'violet', studyTargetSeconds: 18000, sleepTargetMinutes: 450, waterGoalGlasses: 10 }, database)
    assert.deepEqual(saved.profile, { displayName: 'Mira', avatarColor: 'violet' })
    assert.equal(saved.studyTargetSeconds, 18000)
    assert.equal(saved.sleepTargetMinutes, 450)
    assert.equal(saved.waterGoalGlasses, 10)
    database.close(); database = await openCurrent(databaseName)
    assert.deepEqual(await getSettings(database), saved)
  })

  it('rejects invalid profile settings without changing the saved record', async () => {
    const before = await getSettings(database)
    await assert.rejects(saveProfile({ displayName: 'Mira', avatarColor: 'orange', studyTargetSeconds: 30, sleepTargetMinutes: 480, waterGoalGlasses: 8 }, database), /study goal/)
    assert.deepEqual(await getSettings(database), before)
  })
})

describe('notifications', () => {
  it('persists preferences and claims each reminder once per local date', async () => {
    const saved = await saveNotificationPreferences({ enabled: true, studyReminderEnabled: true, studyReminderTime: '09:15', goalReminderEnabled: true, goalReminderTime: '18:00', sleepReminderEnabled: false, sleepReminderTime: '22:00' }, database)
    assert.equal(saved.notifications.studyReminderTime, '09:15')
    database.close(); database = await openCurrent(databaseName)
    assert.equal((await getSettings(database)).notifications.enabled, true)
    assert.equal(await claimReminder('study', '2026-10-21', database), true)
    assert.equal(await claimReminder('study', '2026-10-21', database), false)
    await saveNotificationPreferences({ ...saved.notifications, studyReminderTime: '09:30' }, database)
    assert.equal((await getSettings(database)).notifications.lastStudyReminderDate, '2026-10-21')
    await saveNotificationPreferences({ ...saved.notifications, enabled: false }, database)
    assert.equal(await claimReminder('goal', '2026-10-21', database), false)
  })

  it('reports unsupported, unrequested, granted, and denied permission states correctly', () => {
    assert.equal(notificationPermissionStatus(false), 'Unsupported')
    assert.equal(notificationPermissionStatus(true, 'default'), 'Not requested')
    assert.equal(notificationPermissionStatus(true, 'granted'), 'Granted')
    assert.equal(notificationPermissionStatus(true, 'denied'), 'Denied')
    assert.equal(canSendNotification(true, 'denied'), false)
    assert.equal(canSendNotification(false, 'granted'), false)
    assert.equal(canSendNotification(true, 'granted'), true)
    assert.equal(notificationEnableAction(false), 'unsupported')
    assert.equal(notificationEnableAction(true, 'denied'), 'denied')
    assert.equal(notificationEnableAction(true, 'default'), 'request')
    assert.equal(notificationEnableAction(true, 'granted'), 'enabled')
  })

  it('only sends a daily goal reminder when saved study time is below target', () => {
    assert.equal(shouldSendGoalReminder(0, 21600), true)
    assert.equal(shouldSendGoalReminder(21599, 21600), true)
    assert.equal(shouldSendGoalReminder(21600, 21600), false)
    assert.equal(shouldSendGoalReminder(30000, 21600), false)
  })
})

describe('Lumi data backup', () => {
  it('exports actual store contents and reports local record counts', async () => {
    await database.put('tasks', { id: 'task-1', title: 'Read', time: '10:00', date: '2026-10-21' })
    const backup = await exportLumiData(database)
    assert.equal(backup.format, 'lumi-backup')
    assert.deepEqual(backup.stores.tasks, [{ id: 'task-1', title: 'Read', time: '10:00', date: '2026-10-21' }])
    assert.equal((await getLocalDataCounts(database)).tasks, 1)
    assert.equal(validateLumiBackup(backup).stores.tasks.length, 1)
  })

  it('validates before replacing data and atomically restores a supported backup', async () => {
    await database.put('tasks', { id: 'old-task', title: 'Old', time: '10:00', date: '2026-10-21' })
    const malformed = { format: 'lumi-backup', version: 1, stores: { tasks: [{ id: 'bad', title: 4, date: 'not-a-date' }] } }
    assert.throws(() => validateLumiBackup(malformed), /invalid tasks/)
    assert.equal((await database.getAll('tasks')).length, 1)

    const backup = validateLumiBackup({ format: 'lumi-backup', version: 1, stores: { tasks: [{ id: 'new-task', title: 'New', time: '11:00', date: '2026-10-21' }] } })
    await replaceLumiData(backup, database)
    assert.deepEqual(await database.getAll('tasks'), [{ id: 'new-task', title: 'New', time: '11:00', date: '2026-10-21' }])
    assert.equal((await database.getAll('settings')).length, 1)
  })
})
