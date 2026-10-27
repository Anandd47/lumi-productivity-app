export type SupabaseConfiguration =
  | { status: 'unconfigured' }
  | { status: 'invalid'; message: string }
  | { status: 'valid'; url: string; publishableKey: string }

/** Validate the project API base URL without silently rewriting a wrong project path. */
export function validateSupabaseConfiguration(urlValue?: string, keyValue?: string): SupabaseConfiguration {
  const url = urlValue?.trim() ?? ''
  const publishableKey = keyValue?.trim() ?? ''
  if (!url && !publishableKey) return { status: 'unconfigured' }
  if (!url) return { status: 'invalid', message: 'VITE_SUPABASE_URL is missing. Copy the Project URL from your Supabase project settings.' }
  if (!publishableKey) return { status: 'invalid', message: 'VITE_SUPABASE_PUBLISHABLE_KEY is missing. Add the project’s public publishable/anon key.' }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { status: 'invalid', message: 'VITE_SUPABASE_URL is not a valid URL. Use the Project URL from Supabase Project Settings → API.' }
  }

  const host = parsed.hostname.toLowerCase()
  if (host === 'supabase.com' || host === 'www.supabase.com' || host === 'app.supabase.com') {
    return { status: 'invalid', message: 'This is a Supabase dashboard URL, not the project API URL. Copy Project URL from Supabase Project Settings → API.' }
  }
  const localHost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
  if (parsed.protocol !== 'https:' && !(localHost && parsed.protocol === 'http:')) {
    return { status: 'invalid', message: 'VITE_SUPABASE_URL must use HTTPS (HTTP is allowed only for a local Supabase instance).' }
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    return { status: 'invalid', message: 'VITE_SUPABASE_URL must contain only the project API origin, without credentials, query parameters, or a fragment.' }
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    return { status: 'invalid', message: 'VITE_SUPABASE_URL must be the project API origin with no path. Use a URL like https://<project-ref>.supabase.co, not a dashboard URL or a URL ending in /auth/v1.' }
  }

  return { status: 'valid', url: parsed.origin, publishableKey }
}
