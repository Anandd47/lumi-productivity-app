import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../auth/supabaseClient'

type AccessStatus = 'checking' | 'authorized' | 'unauthorized' | 'unavailable'
type AccessResult = { userId: string | undefined; status: AccessStatus; message?: string }
type AccessResponse = { authorized: boolean }

async function classifyAccessError(error: unknown): Promise<{ status: 'unauthorized' | 'unavailable'; message: string }> {
  const response = error && typeof error === 'object' && 'context' in error && error.context instanceof Response
    ? error.context
    : undefined
  if (response?.status === 403) {
    const body = await response.clone().json().catch(() => null) as { error?: unknown } | null
    if (typeof body?.error === 'string' && /not authorized for Creator Access/i.test(body.error)) {
      return { status: 'unauthorized', message: 'Creator access is not enabled for this account.' }
    }
  }
  if (response?.status === 401) {
    return { status: 'unavailable', message: 'Your session needs to be refreshed before creator access can be checked.' }
  }
  return { status: 'unavailable', message: 'Creator access could not be checked. Please try again.' }
}

export function useCreatorAccess(userId: string | undefined) {
  const [result, setResult] = useState<AccessResult>({ userId: undefined, status: 'checking' })
  const requestId = useRef(0)

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current
    setResult({ userId, status: 'checking' })
    if (!userId) {
      setResult({ userId, status: 'unauthorized' })
      return
    }
    if (!supabase) {
      setResult({ userId, status: 'unavailable', message: 'Creator access is temporarily unavailable.' })
      return
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('creator-access-timeout')), 15_000)
      })
      const { data, error } = await Promise.race([
        supabase.functions.invoke<AccessResponse>('admin-users', { body: { action: 'check' } }),
        timeout,
      ])
      if (currentRequest !== requestId.current) return
      if (error) {
        const classified = await classifyAccessError(error)
        if (currentRequest === requestId.current) setResult({ userId, ...classified })
        return
      }
      if (data?.authorized === true) setResult({ userId, status: 'authorized' })
      else if (data?.authorized === false) setResult({ userId, status: 'unauthorized' })
      else setResult({ userId, status: 'unavailable', message: 'Creator access could not be verified. Please try again.' })
    } catch {
      if (currentRequest === requestId.current) setResult({ userId, status: 'unavailable', message: 'Creator access could not be checked. Please try again.' })
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
    return () => { requestId.current += 1 }
  }, [refresh, userId])

  // Never briefly carry a previous account's authorization into a new session.
  return {
    status: result.userId === userId ? result.status : 'checking',
    message: result.userId === userId ? result.message : undefined,
    refresh,
  }
}
