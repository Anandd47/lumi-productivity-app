import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { getDatabase, getDatabaseName, setDatabaseScope } from '../src/data/database.ts'
import { validateSupabaseConfiguration } from '../src/features/auth/config.ts'
import { resolveAccountDisplayName } from '../src/features/auth/profileName.ts'
import { formatAuthError } from '../src/features/auth/authErrors.ts'
import { ANDROID_AUTH_CALLBACK_URL, authRedirectUrl } from '../src/features/auth/authRedirect.ts'

function deleteDatabase(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = resolve
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error(`Database ${name} remained open`))
  })
}

afterEach(() => setDatabaseScope('device'))

describe('multi-user local cache foundation', () => {
  it('prefers the saved account name, falls back to signup metadata, and never infers from email', () => {
    assert.equal(resolveAccountDisplayName('  Asha  ', 'Signup name'), 'Asha')
    assert.equal(resolveAccountDisplayName('', 'Signup name'), 'Signup name')
    assert.equal(resolveAccountDisplayName('', ''), null)
    assert.equal(resolveAccountDisplayName('A'.repeat(60), null)?.length, 48)
  })

  it('accepts only a Supabase API origin and reports missing or malformed configuration safely', () => {
    assert.deepEqual(validateSupabaseConfiguration('', ''), { status: 'unconfigured' })
    assert.equal(validateSupabaseConfiguration('', 'public-key').status, 'invalid')
    assert.equal(validateSupabaseConfiguration('not a url', 'public-key').status, 'invalid')
    assert.match(validateSupabaseConfiguration('https://supabase.com/dashboard/project/demo', 'public-key').status === 'invalid' ? validateSupabaseConfiguration('https://supabase.com/dashboard/project/demo', 'public-key').message : '', /dashboard URL/i)
    const withPath = validateSupabaseConfiguration('https://demo.supabase.co/auth/v1', 'public-key')
    assert.equal(withPath.status, 'invalid')
    if (withPath.status === 'invalid') assert.match(withPath.message, /no path/i)
    assert.deepEqual(validateSupabaseConfiguration('https://demo.supabase.co/', 'public-key'), { status: 'valid', url: 'https://demo.supabase.co', publishableKey: 'public-key' })
  })

  it('selects a registered Android email callback and keeps web redirects on the current origin', () => {
    assert.equal(ANDROID_AUTH_CALLBACK_URL, 'com.anand.lumi://auth/callback')
    assert.equal(authRedirectUrl('android', 'https://localhost'), ANDROID_AUTH_CALLBACK_URL)
    assert.equal(authRedirectUrl('web', 'https://lumi.example'), 'https://lumi.example')
  })

  it('shows useful signup errors without exposing auth tokens or passwords', () => {
    assert.match(formatAuthError('signup', { code: 'email_exists', message: 'User already registered' }), /already exists/i)
    assert.match(formatAuthError('signup', { code: 'weak_password', message: 'Password should be at least 12 characters' }), /12 characters/i)
    assert.match(formatAuthError('login', { code: 'email_not_confirmed', message: 'Email not confirmed' }), /confirm your email/i)
    assert.match(formatAuthError('signup', { message: 'Failed to fetch' }), /connection/i)
    assert.doesNotMatch(formatAuthError('signup', { message: 'Denied access_token=secret refresh_token=private password=hunter2' }), /secret|private|hunter2/)
  })

  it('keeps the legacy local database name and derives separate account database names', () => {
    assert.equal(getDatabaseName('device'), 'lumi-local')
    assert.equal(getDatabaseName('user-account-a'), 'lumi-local-user-account-a')
    assert.notEqual(getDatabaseName('user-account-a'), getDatabaseName('user-account-b'))
  })

  it('does not expose one signed-in account cache to another account', async () => {
    const firstName = getDatabaseName('user-account-a')
    const secondName = getDatabaseName('user-account-b')
    try {
      setDatabaseScope('account-a')
      const first = await getDatabase()
      await first.put('habits', { id: 'private-habit', name: 'Private routine', icon: 'star', color: 'violet', targetPerWeek: 3, kind: 'core', createdAt: '2026-10-21' })

      setDatabaseScope('account-b')
      const second = await getDatabase()
      assert.deepEqual(await second.getAll('habits'), [])
    } finally {
      setDatabaseScope('device')
      await deleteDatabase(firstName)
      await deleteDatabase(secondName)
    }
  })
})
