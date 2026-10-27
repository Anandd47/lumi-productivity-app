import assert from 'node:assert/strict'
import test from 'node:test'
import { screenFromPath, screenPaths } from '../src/features/navigation/routes.ts'

test('all dashboard screens support direct URLs and nested screens retain the More tab route', () => {
  for (const [screen, path] of Object.entries(screenPaths)) {
    assert.equal(screenFromPath(path), screen)
  }
})

test('screen URL matching tolerates trailing slashes and falls back safely for unknown paths', () => {
  assert.equal(screenFromPath('/insights/'), 'Insights')
  assert.equal(screenFromPath('/not-a-lumi-screen'), 'Home')
})
