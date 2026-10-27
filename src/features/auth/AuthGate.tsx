import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import type { Session, User } from '@supabase/supabase-js'
import { ArrowLeft, LockKeyhole, Orbit, Sparkles } from 'lucide-react'
import { setDatabaseScope } from '../../data/database'
import { supabase, supabaseConfiguration } from './supabaseClient'
import { resolveAccountDisplayName } from './profileName'
import { formatAuthError } from './authErrors'
import { authRedirectUrl } from './authRedirect'
import './auth.css'

type Mode = 'login' | 'signup' | 'forgot' | 'reset'
export type LumiAccountProfile = { userId: string; email: string | null; displayName: string | null; loading: boolean; error: string | null; saveDisplayName: (displayName: string) => Promise<void> }
function metadataDisplayName(user: User): string | null { return resolveAccountDisplayName(null, user.user_metadata?.display_name) }
async function loadOrCreateAccountProfile(user: User): Promise<string | null> {
  if (!supabase) return metadataDisplayName(user)
  const client = supabase
  const read = () => client.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
  const { data, error } = await read()
  if (error) throw new Error('Could not load your account profile. ' + error.message)
  if (data) return resolveAccountDisplayName(data.display_name, metadataDisplayName(user))
  const initialName = metadataDisplayName(user) ?? ''
  const { data: created, error: createError } = await client.from('profiles').insert({ id: user.id, display_name: initialName }).select('display_name').maybeSingle()
  if (!createError && created) return resolveAccountDisplayName(created.display_name, metadataDisplayName(user))
  const retry = await read()
  if (!retry.error && retry.data) return resolveAccountDisplayName(retry.data.display_name, metadataDisplayName(user))
  throw new Error('Could not create your account profile. ' + (createError?.message ?? retry.error?.message ?? ''))
}
export function AuthGate({ children }: { children: (account?: LumiAccountProfile) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [accountDisplayName, setAccountDisplayName] = useState<string | null>(null)
  const [accountProfileLoading, setAccountProfileLoading] = useState(false)
  const [accountProfileError, setAccountProfileError] = useState<string | null>(null)
  const [ready, setReady] = useState(!supabase)
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const callbackCodes = useRef(new Set<string>())
  useEffect(() => {
    if (supabaseConfiguration.status === 'invalid' && import.meta.env.DEV) console.warn('[Lumi auth] Account access configuration is invalid:', supabaseConfiguration.message)
  }, [])
  useEffect(() => {
    if (!supabase || Capacitor.getPlatform() !== 'android') return
    const client = supabase
    let active = true
    let listener: { remove: () => Promise<void> } | undefined

    const handleCallback = async (url: string) => {
      let callback: URL
      try { callback = new URL(url) } catch { return }
      if (callback.protocol !== 'com.anand.lumi:' || callback.hostname !== 'auth' || callback.pathname !== '/callback') return

      const callbackError = callback.searchParams.get('error_code') ?? callback.searchParams.get('error')
      if (callbackError) {
        const description = callback.searchParams.get('error_description') ?? callbackError
        setError(/expired|invalid|otp/i.test(description) ? 'This email link has expired or is invalid. Request a new one and try again.' : 'The email link could not be completed. Request a new link and try again.')
        return
      }

      const code = callback.searchParams.get('code')
      if (!code || callbackCodes.current.has(code)) return
      callbackCodes.current.add(code)
      const { error: exchangeError } = await client.auth.exchangeCodeForSession(code)
      if (exchangeError) {
        callbackCodes.current.delete(code)
        if (active) setError(formatAuthError('login', exchangeError))
      } else if (active) {
        setError('')
        setMessage('Your email is confirmed. Your account is ready.')
      }
    }

    const onCallback = ({ url }: { url: string }) => {
      void handleCallback(url).catch((cause: unknown) => {
        if (active) setError(formatAuthError('login', cause))
      })
    }
    void App.addListener('appUrlOpen', onCallback).then((registered) => {
      if (active) listener = registered
      else void registered.remove()
    }).catch((cause: unknown) => {
      if (import.meta.env.DEV) console.error('[Lumi auth] Android callback listener unavailable:', cause instanceof Error ? cause.name : 'unknown error')
    })
    void App.getLaunchUrl().then((launch) => {
      if (active && launch?.url) return handleCallback(launch.url)
    }).catch((cause: unknown) => {
      if (import.meta.env.DEV) console.error('[Lumi auth] Android launch link could not be read:', cause instanceof Error ? cause.name : 'unknown error')
    })

    return () => {
      active = false
      if (listener) void listener.remove()
    }
  }, [])
  useEffect(() => {
    if (!supabase) { setDatabaseScope('device'); return }
    let active = true
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) {
        if (import.meta.env.DEV) console.error('[Lumi auth] Session restore failed:', sessionError.message)
        setError('We couldn’t restore your account session. Please sign in again.')
      }
      setSession(data.session)
      if (data.session?.user.id) setDatabaseScope(data.session.user.id)
      setReady(true)
    }).catch((caught: unknown) => {
      if (!active) return
      if (import.meta.env.DEV) console.error('[Lumi auth] Session restore failed:', caught instanceof Error ? caught.message : 'Unknown session error')
      setError('We couldn’t restore your account session. Please sign in again.')
      setReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY') setMode('reset')
      setSession(nextSession)
      if (nextSession?.user.id) setDatabaseScope(nextSession.user.id)
      else setDatabaseScope('device')
      setReady(true)
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  useEffect(() => {
    if (!supabase || !session?.user) { setAccountDisplayName(null); setAccountProfileLoading(false); setAccountProfileError(null); return }
    let active = true
    setAccountProfileLoading(true); setAccountProfileError(null)
    void loadOrCreateAccountProfile(session.user).then((name) => { if (active) setAccountDisplayName(name) }).catch((cause: unknown) => {
      if (!active) return
      setAccountDisplayName(metadataDisplayName(session.user))
      if (import.meta.env.DEV) console.error('[Lumi auth] Account profile load failed:', cause instanceof Error ? cause.message : 'Unknown profile error')
      setAccountProfileError('We couldn’t load your account profile. Please try again later.')
    }).finally(() => { if (active) setAccountProfileLoading(false) })
    return () => { active = false }
  }, [session?.user.id])
  async function saveAccountDisplayName(value: string): Promise<void> {
    const nextName = value.trim()
    if (nextName.length > 48) throw new Error('Your display name must be 48 characters or fewer.')
    if (!supabase || !session?.user.id) throw new Error('Sign in again to update your account name.')
    const { data, error: saveError } = await supabase.from('profiles').upsert({ id: session.user.id, display_name: nextName }, { onConflict: 'id' }).select('display_name').single()
    if (saveError) {
      if (import.meta.env.DEV) console.error('[Lumi auth] Account display name save failed:', saveError.message)
      throw new Error('Your account name could not be saved. Please try again.')
    }
    setAccountDisplayName(resolveAccountDisplayName(data.display_name, null)); setAccountProfileError(null)
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('')
    if (!supabase) return
    if (!email.trim() || !email.includes('@')) { setError('Enter a valid email address.'); return }
    if ((mode === 'login' || mode === 'signup' || mode === 'reset') && password.length < 8) { setError('Use a password with at least 8 characters.'); return }
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: displayName.trim() }, emailRedirectTo: authRedirectUrl(Capacitor.getPlatform(), window.location.origin) } })
        if (authError) throw authError
        setMessage(data.session ? 'Your account is ready.' : 'If this email can be registered, a confirmation link is on its way. Open it on this device to finish setup.')
      } else if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (authError) throw authError
      } else if (mode === 'forgot') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirectUrl(Capacitor.getPlatform(), window.location.origin) })
        if (authError) throw authError
        setMessage('If an account exists for that email, a password reset link is on its way.')
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password })
        if (authError) throw authError
        setMode('login'); setPassword(''); setMessage('Password updated. You can sign in with your new password.')
      }
    } catch (caught) {
      const code = caught && typeof caught === 'object' && 'code' in caught ? String(caught.code) : 'unknown'
      const status = caught && typeof caught === 'object' && 'status' in caught ? String(caught.status) : 'unknown'
      if (import.meta.env.DEV) console.error(`[Lumi auth] ${mode} request failed (code=${code}, status=${status})`)
      setError(formatAuthError(mode, caught))
    } finally { setBusy(false) }
  }
  const configurationMessage = supabaseConfiguration.status === 'invalid' ? 'Account sign-in is temporarily unavailable. Please check the app setup and try again.' : 'Account sign-in is not set up yet. Please check the app setup.'
  if (supabaseConfiguration.status !== 'valid') return <main className="auth-shell">
    <div className="space-grain" aria-hidden="true" /><div className="ambient ambient-one" aria-hidden="true" /><div className="ambient ambient-two" aria-hidden="true" />
    <div className="auth-layout"><AuthVisual /><section className="auth-panel" aria-labelledby="auth-config-title">
      <a className="auth-brand" href="/" aria-label="Lumi home"><img className="brand-symbol" src="/lumi-mark.svg" alt="" /> <span>Lumi</span></a>
      <span className="auth-kicker"><LockKeyhole size={13} /> ACCOUNT SETUP</span>
      <h1 id="auth-config-title">{supabaseConfiguration.status === 'unconfigured' ? 'Set up account access' : 'Check your connection settings'}</h1>
      <p className="auth-error" role="alert">{configurationMessage}</p>
      <p className="auth-description">Sign-up and sign-in will be available once account access is configured.</p>
    </section></div><AuthFooter />
  </main>
  if (!supabase) return null
  if (!ready) return <main className="auth-shell"><div className="space-grain" aria-hidden="true" /><div className="ambient ambient-one" aria-hidden="true" /><div className="ambient ambient-two" aria-hidden="true" /><div className="auth-layout"><AuthVisual /><div className="auth-panel auth-loading"><Orbit size={25} /><span>Restoring your Lumi session…</span></div></div><AuthFooter /></main>
  if (session && mode !== 'reset') return <>{children({ userId: session.user.id, email: session.user.email ?? null, displayName: accountDisplayName, loading: accountProfileLoading, error: accountProfileError, saveDisplayName: saveAccountDisplayName })}</>
  const title = mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : mode === 'reset' ? 'Choose a new password' : 'Welcome back'
  const submitLabel = mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : mode === 'reset' ? 'Save new password' : 'Sign in'
  return <main className="auth-shell">
    <div className="space-grain" aria-hidden="true" /><div className="ambient ambient-one" aria-hidden="true" /><div className="ambient ambient-two" aria-hidden="true" />
    <div className="auth-layout"><AuthVisual /><section className="auth-panel" aria-labelledby="auth-title">
      <a className="auth-brand" href="/" aria-label="Lumi home"><img className="brand-symbol" src="/lumi-mark.svg" alt="" /> <span>Lumi</span></a>
      <span className="auth-kicker"><Sparkles size={13} /> YOUR SPACE, YOUR PACE</span>
      <h1 id="auth-title">{title}</h1>
      <p className="auth-description">{mode === 'signup' ? 'Save your progress to your Lumi account.' : mode === 'forgot' ? 'We will send a secure reset link if the account exists.' : mode === 'reset' ? 'Set a new password for your account.' : 'Sign in to continue to your personal dashboard.'}</p>
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        {mode === 'signup' && <label>Display name <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={48} autoComplete="name" /></label>}
        {mode !== 'reset' && <label>Email <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>}
        {mode !== 'forgot' && <label>{mode === 'reset' ? 'New password' : 'Password'} <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete={mode === 'signup' || mode === 'reset' ? 'new-password' : 'current-password'} required /></label>}
        {error && <p className="auth-error" role="alert">{error}</p>}{message && <p className="auth-message" role="status">{message}</p>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : submitLabel}</button>
      </form>
      <div className="auth-links">{mode === 'login' && <><button type="button" onClick={() => { setMode('signup'); setMessage(''); setError('') }}>Create account</button><button type="button" onClick={() => { setMode('forgot'); setMessage(''); setError('') }}>Forgot password?</button></>}{mode !== 'login' && <button type="button" onClick={() => { setMode('login'); setMessage(''); setError('') }}><ArrowLeft size={13} /> Back to sign in</button>}</div>
    </section></div><AuthFooter />
  </main>
}
function AuthVisual() {
  return <aside className="auth-visual" aria-hidden="true"><div className="auth-orb-mark"><span className="auth-orb-ring" /><span className="auth-orb-core" /><i className="auth-orb-star star-a" /><i className="auth-orb-star star-b" /><i className="auth-orb-star star-c" /></div><p>Small steps add up to stardust.</p></aside>
}
function AuthFooter() { return <footer className="auth-footer"><span>Made with ♡ by Anand</span></footer> }
