export type AuthMode = 'login' | 'signup' | 'forgot' | 'reset'

type AuthFailure = {
  code?: unknown
  message?: unknown
  status?: unknown
}

function safeDetail(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
    .replace(/\b(access_token|refresh_token|service_role_key|password|code)=?[^\s&;,]*/gi, '$1=[redacted]')
    .slice(0, 240)
}

export function formatAuthError(mode: AuthMode, failure: unknown): string {
  const authFailure = failure && typeof failure === 'object' ? failure as AuthFailure : {}
  const code = typeof authFailure.code === 'string' ? authFailure.code.toLowerCase() : ''
  const detail = safeDetail(authFailure.message)
  const normalized = `${code} ${detail}`.toLowerCase()

  if (/user_already_exists|email_exists|already registered|already been registered/.test(normalized)) {
    return 'An account with this email already exists. Sign in instead.'
  }
  if (/invalid_credentials|invalid login credentials/.test(normalized)) {
    return 'That email and password do not match. Check them and try again.'
  }
  if (/email_not_confirmed/.test(normalized)) {
    return 'Please confirm your email from the link we sent before signing in.'
  }
  if (/weak_password|password should be at least|password is too short/.test(normalized)) {
    return detail || 'Choose a stronger password and try again.'
  }
  if (/redirect_to_not_allowed|redirect url.*not allowed|not a valid redirect url/.test(normalized)) {
    return 'Lumi could not prepare the email link. The app return URL must be added to the Supabase Auth redirect allowlist.'
  }
  if (/over_email_send_rate_limit|over_request_rate_limit/.test(normalized)) {
    return 'Too many account requests were made. Wait a little while, then try again.'
  }
  if (/failed to fetch|network|fetcherror|connection|timeout/.test(normalized)) {
    return 'Lumi could not reach the account service. Check your connection and try again.'
  }
  if (/database error saving new user/.test(normalized)) {
    return 'Lumi could not finish setting up this account. Please try again later.'
  }

  const fallback: Record<AuthMode, string> = {
    login: 'We couldn’t sign you in.',
    signup: 'We couldn’t create your account.',
    forgot: 'We couldn’t send the reset link.',
    reset: 'We couldn’t update your password.',
  }
  return detail ? `${fallback[mode]} ${detail}` : fallback[mode]
}
