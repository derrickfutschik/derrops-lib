import { useCallback, useEffect, useMemo, useState } from 'react'
import { type CloudRelayConnection } from '@/client/slaops-cloud'
import { useConnections } from '@/hooks/useConnectionsApi'

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'slaops_apitester_relay'

// ── Hook ───────────────────────────────────────────────────────────────────

export function useRelaySelector() {
  const { data: connections = [], isLoading } = useConnections()

  const [connectionId, setConnectionIdState] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? (JSON.parse(stored) as string) : null
    } catch {
      return null
    }
  })

  const [deletedWarning, setDeletedWarning] = useState(false)

  // After connections load: validate stored selection and auto-select if unset
  useEffect(() => {
    if (isLoading || connections.length === 0) return

    if (connectionId !== null) {
      const found = connections.find((c) => c.id === connectionId)
      if (!found) {
        setConnectionIdState(null)
        localStorage.removeItem(STORAGE_KEY)
        setDeletedWarning(true)
      }
      return
    }

    // No stored preference — auto-select first non-local connection
    const firstNonLocal = connections.find((c) => c.type !== 'local-dev')
    if (firstNonLocal) {
      setConnectionIdState(firstNonLocal.id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(firstNonLocal.id))
    }
  }, [connections, isLoading, connectionId])

  const setConnectionId = useCallback(
    (id: string | null) => {
      setConnectionIdState(id)
      if (id === null) {
        localStorage.removeItem(STORAGE_KEY)
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(id))
      }
    },
    [],
  )

  const connection: CloudRelayConnection | null = useMemo(
    () => connections.find((c) => c.id === connectionId) ?? null,
    [connections, connectionId],
  )

  const clearDeletedWarning = useCallback(() => setDeletedWarning(false), [])

  return {
    connectionId,
    connection,
    connections,
    isLoading,
    setConnectionId,
    deletedWarning,
    clearDeletedWarning,
  }
}
