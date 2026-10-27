import { createClient } from '@supabase/supabase-js'
import { validateSupabaseConfiguration } from './config'

export const supabaseConfiguration = validateSupabaseConfiguration(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

export const supabase = supabaseConfiguration.status === 'valid'
  ? createClient(supabaseConfiguration.url, supabaseConfiguration.publishableKey)
  : null
export const supabaseConfigured = supabaseConfiguration.status !== 'unconfigured'
