import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildTaskImportPlan, isCloudTaskId } from '../src/features/tasks/cloudMapping.ts'
import {
  buildTaskRpcWrite,
  isTaskIconSchemaError,
  mapCloudTaskRow,
  toCloudTaskRow,
  TASK_ICON_SYNC_SETUP_MESSAGE,
} from '../src/features/tasks/cloudSerialization.ts'

const task = (id, title = 'Review notes', date = '2026-10-21') => ({ id, title, time: '09:00', date })
const a = '11111111-1111-4111-8111-111111111111'
const b = '22222222-2222-4222-8222-222222222222'

describe('cloud task import safety', () => {
  it('keeps existing UUID task IDs and skips matching cloud rows without overwriting', () => {
    const plan = buildTaskImportPlan([task(a), task(b, 'Read chapter')], [task(a)])
    assert.equal(isCloudTaskId(a), true)
    assert.deepEqual(plan.addTasks, [task(b, 'Read chapter')])
    assert.equal(plan.duplicateCount, 1)
    assert.deepEqual(plan.completionTasks.map(({ id }) => id).sort(), [a, b].sort())
  })

  it('excludes same-ID content conflicts and invalid IDs instead of rewriting or remapping silently', () => {
    const plan = buildTaskImportPlan([task(a, 'Local version'), task('legacy-task-id')], [task(a, 'Cloud version')])
    assert.deepEqual(plan.addTasks, [])
    assert.deepEqual(plan.completionTasks, [])
    assert.equal(plan.conflictCount, 1)
    assert.equal(plan.unsupportedIdCount, 1)
  })

  it('deduplicates identical local copies from the device and account cache', () => {
    const plan = buildTaskImportPlan([task(a), task(a)], [])
    assert.deepEqual(plan.addTasks, [task(a)])
    assert.equal(plan.duplicateCount, 1)
  })

  it('preserves optional task icons and treats different icon selections as an import conflict', () => {
    const withIcon = { ...task(a), icon: 'book-open' }
    const plan = buildTaskImportPlan([withIcon], [task(a)])
    assert.deepEqual(plan.addTasks, [])
    assert.deepEqual(plan.completionTasks, [])
    assert.equal(plan.conflictCount, 1)
    const unchanged = buildTaskImportPlan([withIcon], [withIcon])
    assert.equal(unchanged.duplicateCount, 1)
  })
})

describe('task icon cloud compatibility', () => {
  it('writes icon-bearing tasks through the icon RPC and iconless tasks through the legacy RPC', () => {
    const withIcon = buildTaskRpcWrite(a, { ...task(a), icon: 'book-open' })
    assert.equal(withIcon.name, 'save_lumi_task_with_icon')
    assert.equal(withIcon.args.p_icon, 'book-open')

    const withoutIcon = buildTaskRpcWrite(a, task(a))
    assert.equal(withoutIcon.name, 'save_lumi_task')
    assert.equal('p_icon' in withoutIcon.args, false)
  })

  it('sends explicit null when an edit removes a previously selected icon', () => {
    const cleared = buildTaskRpcWrite(a, { ...task(a), icon: null }, true)
    assert.equal(cleared.name, 'save_lumi_task_with_icon')
    assert.equal(cleared.args.p_icon, null)
  })

  it('round-trips task icons while keeping legacy rows without icons valid', () => {
    const cloud = toCloudTaskRow({ ...task(a), icon: 'book-open' }, 'user-1')
    assert.equal(cloud.icon, 'book-open')
    assert.equal(mapCloudTaskRow({ id: a, title: 'Review notes', time: '09:00', local_date: '2026-10-21', icon: 'book-open' }).icon, 'book-open')

    const legacy = mapCloudTaskRow({ id: b, title: 'Read chapter', time: '10:00', local_date: '2026-10-21' })
    assert.equal('icon' in legacy, false)
    assert.equal(toCloudTaskRow(legacy, 'user-1').icon, undefined)
  })

  it('recognizes only icon schema/RPC cache errors as migration setup issues', () => {
    assert.equal(isTaskIconSchemaError({ code: 'PGRST202', message: 'Could not find the function public.save_lumi_task_with_icon without parameters in the schema cache' }), true)
    assert.equal(isTaskIconSchemaError({ code: 'PGRST204', message: "Could not find the 'icon' column of 'tasks' in the schema cache" }), true)
    assert.equal(isTaskIconSchemaError({ code: '42703', message: 'column tasks.icon does not exist' }), true)
    assert.equal(isTaskIconSchemaError({ code: 'PGRST202', message: 'Could not find the function public.save_lumi_task without parameters in the schema cache' }), false)
    assert.equal(isTaskIconSchemaError({ code: '42501', message: 'permission denied for table tasks' }), false)
    assert.match(TASK_ICON_SYNC_SETUP_MESSAGE, /task icon migration/i)
  })
})
