import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, RefreshCw, Search, ShieldCheck, UsersRound } from 'lucide-react'
import { supabase } from '../auth/supabaseClient'
import './admin-users.css'

type RegisteredUser = { id: string; email: string | null; createdAt: string; emailVerified: boolean }
type RegistrationMonth = { month: string; count: number }
type OverviewResponse = { totalUsers: number; confirmedUsers: number; registrationsByMonth: RegistrationMonth[] }
type DirectoryResponse = { users: RegisteredUser[]; page: number; perPage: number; totalUsers: number; totalMatches?: number; hasMore: boolean }

function responseStatus(error: unknown): number | undefined {
  return error && typeof error === 'object' && 'context' in error && error.context instanceof Response ? error.context.status : undefined
}

function errorMessage(status: number | undefined): string {
  if (status === 401) return 'Your session expired. Sign in again to continue.'
  if (status === 403) return 'Creator access is not enabled for this account.'
  if (status === 503) return 'Creator services are not ready yet. Please try again later.'
  return 'Registered accounts could not be loaded. Please try again.'
}

function monthLabel(value: string): string {
  return new Date(`${value}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })
}

export function AdminUsersScreen({ adminId }: { adminId: string }) {
  const [users, setUsers] = useState<RegisteredUser[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalMatches, setTotalMatches] = useState<number | null>(null)
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [loadedForId, setLoadedForId] = useState<string | null>(null)
  const [overviewForId, setOverviewForId] = useState<string | null>(null)
  const [verifiedForId, setVerifiedForId] = useState<string | null>(null)
  const requestId = useRef(0)
  const overviewRequestId = useRef(0)

  const loadOverview = useCallback(async () => {
    const currentRequest = ++overviewRequestId.current
    if (!supabase) { setError('Creator services are not configured.'); setOverviewLoading(false); return }
    setOverviewLoading(true)
    const { data, error: invokeError } = await supabase.functions.invoke<OverviewResponse>('admin-users', { body: { action: 'overview' } })
    if (currentRequest !== overviewRequestId.current) return
    if (invokeError) {
      const status = responseStatus(invokeError)
      setOverview(null)
      if (status === 403) setAccessDenied(true)
      setError(errorMessage(status))
      setOverviewLoading(false)
      return
    }
    if (!data || !Array.isArray(data.registrationsByMonth)) {
      setOverview(null); setError('The account statistics could not be read. Please refresh.'); setOverviewLoading(false); return
    }
    setAccessDenied(false)
    setOverview(data)
    setOverviewForId(adminId)
    setVerifiedForId(adminId)
    setError(null)
    setOverviewLoading(false)
  }, [adminId])

  const loadUsers = useCallback(async (nextPage: number, query: string) => {
    const currentRequest = ++requestId.current
    if (!supabase) { setError('Creator services are not configured.'); setLoading(false); return }
    setLoading(true)
    setError(null)
    const action = query ? 'search' : 'list'
    const payload = query ? { action, page: nextPage, query } : { action, page: nextPage }
    const { data, error: invokeError } = await supabase.functions.invoke<DirectoryResponse>('admin-users', { body: payload })
    if (currentRequest !== requestId.current) return
    if (invokeError) {
      const status = responseStatus(invokeError)
      setUsers([])
      setTotalMatches(null)
      if (status === 403) setAccessDenied(true)
      setError(errorMessage(status))
      setLoading(false)
      return
    }
    if (!data || !Array.isArray(data.users)) {
      setUsers([]); setError('The account directory returned an unexpected response.'); setLoading(false); return
    }
    setAccessDenied(false)
    setUsers(data.users)
    setLoadedForId(adminId)
    setVerifiedForId(adminId)
    setPage(data.page)
    setHasMore(data.hasMore)
    setTotalMatches(data.totalMatches ?? null)
    setLoading(false)
  }, [adminId])

  useEffect(() => {
    setUsers([]); setOverview(null); setAccessDenied(false); setLoadedForId(null); setOverviewForId(null); setVerifiedForId(null)
    overviewRequestId.current += 1
    void loadOverview()
  }, [adminId, loadOverview])

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearchQuery(searchValue.trim().slice(0, 120)), 300)
    return () => window.clearTimeout(timeout)
  }, [searchValue])

  useEffect(() => { void loadUsers(1, searchQuery) }, [adminId, loadUsers, searchQuery])

  const refresh = () => { void loadOverview(); void loadUsers(page, searchQuery) }
  const visibleUsers = loadedForId === adminId ? users : []
  const visibleOverview = overviewForId === adminId ? overview : null
  const ownerIsVerified = verifiedForId === adminId
  const largestMonth = Math.max(1, ...(visibleOverview?.registrationsByMonth.map((item) => item.count) ?? [0]))
  const denied = accessDenied || (error !== null && !visibleOverview && !loading && error.includes('Creator access'))

  return <main className="app-shell admin-users-shell">
    <div className="space-grain" aria-hidden="true" />
    <div className="ambient ambient-one" aria-hidden="true" />
    <section className="admin-users-page" aria-labelledby="registered-users-title">
      <header className="admin-users-header">
        <a href="/" className="admin-users-back"><ArrowLeft size={16} /> Back to Lumi</a>
        <span className="admin-users-secure"><ShieldCheck size={15} />{ownerIsVerified ? 'Access verified' : 'Verifying access…'}</span>
      </header>
      <div className="admin-users-heading">
        <span><UsersRound size={16} /> CREATOR DASHBOARD</span>
        <h1 id="registered-users-title">Registered users</h1>
        <p>Account directory from Supabase Authentication. Only email, account ID, creation date, and email verification status are shown.</p>
      </div>

      {denied && <section className="admin-users-error-panel" role="alert"><strong>Creator access is not available</strong><p>This account is not authorized to view registered users. No account records were returned.</p></section>}
      {!denied && error && <p className="admin-users-error" role="alert">{error}</p>}
      {!denied && <>
        <section className="admin-overview-grid" aria-label="Registration overview" aria-busy={overviewLoading}>
          <article className="admin-overview-card glass"><span>Total registered</span><strong>{overviewLoading ? '—' : visibleOverview?.totalUsers.toLocaleString() ?? 'Unavailable'}</strong><small>Registered accounts</small></article>
          <article className="admin-overview-card glass"><span>Email verified</span><strong>{overviewLoading ? '—' : visibleOverview?.confirmedUsers.toLocaleString() ?? 'Unavailable'}</strong><small>Confirmed email addresses</small></article>
          <article className="admin-overview-card glass"><span>Unverified email</span><strong>{overviewLoading ? '—' : visibleOverview ? (visibleOverview.totalUsers - visibleOverview.confirmedUsers).toLocaleString() : 'Unavailable'}</strong><small>Accounts awaiting confirmation</small></article>
        </section>

        <section className="admin-registration-panel glass" aria-labelledby="registration-stats-title" aria-busy={overviewLoading}>
          <div className="admin-users-panel-heading"><div><h2 id="registration-stats-title">Account registrations</h2><p>By UTC calendar month · last 12 months</p></div></div>
          {overviewLoading ? <p className="admin-users-loading" role="status">Loading account statistics…</p> : visibleOverview ? <div className="admin-registration-chart" aria-label="Monthly account registration counts">
            {visibleOverview.registrationsByMonth.map((item) => <div className="admin-registration-month" key={item.month} aria-label={`${item.month}: ${item.count} registrations`} title={`${item.month}: ${item.count}`}>
              <div className="admin-registration-bar-track"><span style={{ height: item.count ? `${Math.max(8, (item.count / largestMonth) * 100)}%` : '0%' }} /></div>
              <small>{monthLabel(item.month)}</small>
              <b>{item.count}</b>
            </div>)}
          </div> : <p className="admin-users-empty">Registration statistics are not available.</p>}
        </section>

        <section className="admin-users-panel glass" aria-labelledby="account-directory-title" aria-live="polite">
          <div className="admin-users-panel-heading">
            <div><h2 id="account-directory-title">Account directory</h2><p>{searchQuery ? `${totalMatches ?? '…'} matches` : `${visibleOverview?.totalUsers.toLocaleString() ?? '—'} accounts`}</p></div>
            <button type="button" className="admin-users-refresh" onClick={refresh} disabled={loading || overviewLoading} aria-label="Refresh account directory and registration statistics"><RefreshCw size={15} /></button>
          </div>
          <label className="admin-users-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search users by email" value={searchValue} maxLength={120} placeholder="Search by email" autoComplete="off" onChange={(event) => setSearchValue(event.target.value)} /></label>
          {loading && <div className="admin-users-loading" role="status">Loading registered accounts…</div>}
          {!loading && !error && visibleUsers.length === 0 && <p className="admin-users-empty">{searchQuery ? 'No accounts matched that email search.' : 'No registered accounts yet.'}</p>}
          {!loading && !error && visibleUsers.length > 0 && <div className="admin-users-table-wrap"><table className="admin-users-table"><thead><tr><th scope="col">Email</th><th scope="col">Account ID</th><th scope="col">Created</th><th scope="col">Email status</th></tr></thead><tbody>{visibleUsers.map((user) => <tr key={user.id}><td>{user.email ?? 'No email available'}</td><td><code>{user.id}</code></td><td><time dateTime={user.createdAt}>{new Date(user.createdAt).toLocaleDateString()}</time></td><td><span className={`admin-email-status ${user.emailVerified ? 'verified' : 'unverified'}`}>{user.emailVerified ? 'Verified' : 'Unverified'}</span></td></tr>)}</tbody></table></div>}
          {!loading && !error && (searchQuery ? (totalMatches ?? 0) > 0 : (visibleOverview?.totalUsers ?? 0) > 0) && <nav className="admin-users-pagination" aria-label="Registered users pages">
            <button type="button" onClick={() => void loadUsers(page - 1, searchQuery)} disabled={loading || page <= 1}>Previous</button>
            <span>Page {page}</span>
            <button type="button" onClick={() => void loadUsers(page + 1, searchQuery)} disabled={loading || !hasMore}>Next</button>
          </nav>}
        </section>
      </>}
      <footer className="admin-users-footer">Made with ♡ by Anand · Read-only creator access</footer>
    </section>
  </main>
}
