import { createClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'

const allowedOrigins = (Deno.env.get('LUMI_ADMIN_ALLOWED_ORIGINS') ?? '')
  .split(',').map((value) => value.trim()).filter(Boolean)
const AUTH_PAGE_SIZE = 1000
const DISPLAY_PAGE_SIZE = 50
const MAX_SCANNED_PAGES = 100
const REGISTRATION_MONTHS = 12
const DEFAULT_API_KEY_NAME = 'default'

function readInjectedKey(variableName: string): string | null {
  const value = Deno.env.get(variableName)
  if (!value) return null
  try {
    const keys = JSON.parse(value) as Record<string, unknown>
    const defaultKey = keys[DEFAULT_API_KEY_NAME]
    return typeof defaultKey === 'string' ? defaultKey : null
  } catch {
    return null
  }
}

type Action = 'check' | 'overview' | 'list' | 'search'
type RequestBody = { action?: unknown; page?: unknown; query?: unknown }
type DirectoryUser = { id: string; email: string | null; createdAt: string; emailVerified: boolean }

function headers(origin: string | null) {
  const originHeaders = origin !== null && allowedOrigins.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin }
    : {}
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    ...originHeaders,
  }
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) })
}

function toDirectoryUser(user: User): DirectoryUser {
  return {
    id: user.id,
    email: user.email ?? null,
    createdAt: user.created_at,
    emailVerified: Boolean(user.email_confirmed_at),
  }
}

async function readAllUsers(adminClient: ReturnType<typeof createClient>) {
  const first = await adminClient.auth.admin.listUsers({ page: 1, perPage: AUTH_PAGE_SIZE })
  if (first.error) throw new Error(`auth-list:${first.error.code ?? 'unknown'}`)
  const totalUsers = first.data.total
  const lastPage = Math.max(1, first.data.lastPage)
  if (lastPage > MAX_SCANNED_PAGES) throw new Error('directory-scan-limit')

  const users: User[] = [...first.data.users]
  for (let page = 2; page <= lastPage; page += 1) {
    const next = await adminClient.auth.admin.listUsers({ page, perPage: AUTH_PAGE_SIZE })
    if (next.error) throw new Error(`auth-list:${next.error.code ?? 'unknown'}`)
    users.push(...next.data.users)
  }
  return { users, totalUsers }
}

function registrationStats(users: User[], totalUsers: number) {
  const now = new Date()
  const monthKeys = Array.from({ length: REGISTRATION_MONTHS }, (_, index) => {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (REGISTRATION_MONTHS - index - 1), 1))
    return month.toISOString().slice(0, 7)
  })
  const monthlyCounts = new Map(monthKeys.map((key) => [key, 0]))
  let confirmedUsers = 0
  for (const user of users) {
    if (user.email_confirmed_at) confirmedUsers += 1
    const key = user.created_at.slice(0, 7)
    if (monthlyCounts.has(key)) monthlyCounts.set(key, (monthlyCounts.get(key) ?? 0) + 1)
  }
  return {
    totalUsers,
    confirmedUsers,
    registrationsByMonth: monthKeys.map((month) => ({ month, count: monthlyCounts.get(month) ?? 0 })),
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin')
  const originAllowed = origin !== null && allowedOrigins.includes(origin)
  if (request.method === 'OPTIONS') return new Response(null, { status: originAllowed ? 204 : 403, headers: headers(origin) })
  if (!originAllowed) return json({ error: 'Origin is not allowed.' }, 403, origin)
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, origin)

  const accessToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  const projectUrl = Deno.env.get('SUPABASE_URL')
  const publishableKey = readInjectedKey('SUPABASE_PUBLISHABLE_KEYS')
    ?? Deno.env.get('SUPABASE_ANON_KEY')
    ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  const serviceRoleKey = readInjectedKey('SUPABASE_SECRET_KEYS')
    ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!accessToken || !projectUrl || !publishableKey || !serviceRoleKey) {
    return json({ error: 'Creator access is not configured.' }, 503, origin)
  }

  try {
    const callerClient = createClient(projectUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error: authError } = await callerClient.auth.getUser(accessToken)
    if (authError || !user) return json({ error: 'Sign in to continue.' }, 401, origin)

    // The privileged key stays in this function. Public clients have no grants on this table.
    const adminClient = createClient(projectUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: adminGrant, error: grantError } = await adminClient
      .from('lumi_admin_users').select('user_id').eq('user_id', user.id).maybeSingle()
    if (grantError) {
      console.error('[admin-users] Authorization lookup failed:', grantError.code ?? 'unknown')
      return json({ error: 'Creator access could not be checked. Please try again.' }, 503, origin)
    }
    if (!adminGrant) return json({ error: 'This account is not authorized for Creator Access.' }, 403, origin)

    let body: RequestBody
    try { body = await request.json() as RequestBody } catch { return json({ error: 'The request was invalid.' }, 400, origin) }
    const action = body.action as Action
    if (action === 'check') return json({ authorized: true }, 200, origin)
    if (action === 'overview') {
      const { users, totalUsers } = await readAllUsers(adminClient)
      return json(registrationStats(users, totalUsers), 200, origin)
    }

    const page = typeof body.page === 'number' && Number.isInteger(body.page) ? Math.max(1, body.page) : 1
    if (action === 'list') {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: DISPLAY_PAGE_SIZE })
      if (error) {
        console.error('[admin-users] Auth directory request failed:', error.code ?? 'unknown')
        return json({ error: 'Registered accounts could not be loaded. Please try again.' }, 502, origin)
      }
      return json({ users: data.users.map(toDirectoryUser), page, perPage: DISPLAY_PAGE_SIZE, totalUsers: data.total, hasMore: page < data.lastPage }, 200, origin)
    }

    if (action === 'search') {
      const query = typeof body.query === 'string' ? body.query.trim().slice(0, 120).toLocaleLowerCase() : ''
      if (!query) return json({ error: 'Enter an email address to search.' }, 400, origin)
      const { users, totalUsers } = await readAllUsers(adminClient)
      const matches = users.filter((account) => account.email?.toLocaleLowerCase().includes(query))
      const start = (page - 1) * DISPLAY_PAGE_SIZE
      return json({
        users: matches.slice(start, start + DISPLAY_PAGE_SIZE).map(toDirectoryUser),
        page,
        perPage: DISPLAY_PAGE_SIZE,
        totalUsers,
        totalMatches: matches.length,
        hasMore: start + DISPLAY_PAGE_SIZE < matches.length,
      }, 200, origin)
    }

    return json({ error: 'The requested account directory action is not supported.' }, 400, origin)
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown'
    console.error('[admin-users] Directory request failed:', detail)
    return json({ error: detail === 'directory-scan-limit'
      ? 'This account directory is too large for the current registration-statistics request.'
      : 'Registered accounts could not be loaded. Please try again.' }, 503, origin)
  }
})
