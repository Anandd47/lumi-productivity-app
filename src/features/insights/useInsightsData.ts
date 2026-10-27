import { useCallback, useEffect, useState } from 'react'
import { loadInsightsData, type InsightsData } from './repository'

export function useInsightsData() {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try { setData(await loadInsightsData()) }
    catch (cause) { setError(`Lumi couldn't load your saved history. ${cause instanceof Error ? cause.message : 'Unexpected storage error.'}`) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void reload() }, [reload])
  return { data, loading, error, reload }
}

