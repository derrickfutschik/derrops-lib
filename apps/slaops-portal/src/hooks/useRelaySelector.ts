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
    if (isLoading) return

    if (connectionId !== null) {
      // Validate the stored ID against the current connections list
      if (connections.length > 0) {
        const found = connections.find((c) => c.id === connectionId)
        if (!found) {
          setConnectionIdState(null)
          // Store null explicitly so the auto-select below does not trigger
          localStorage.setItem(STORAGE_KEY, JSON.stringify(null))
          setDeletedWarning(true)
        }
      }
      return
    }

    // connectionId === null — distinguish "explicit browser mode" from "no preference yet"
    // An explicit browser selection stores the JSON string "null"; no preference means the key is absent.
    const rawStored = localStorage.getItem(STORAGE_KEY)
    if (rawStored !== null) {
      // User explicitly chose browser mode — respect it
      return
    }

    // No stored preference at all — auto-select first non-local connection
    if (connections.length === 0) return
    const firstNonLocal = connections.find((c) => c.type !== 'local-dev')
    if (firstNonLocal) {
      setConnectionIdState(firstNonLocal.id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(firstNonLocal.id))
    }
  }, [connections, isLoading, connectionId])

  const setConnectionId = useCallback(
    (id: string | null) => {
      setConnectionIdState(id)
      // Always persist explicitly — null stored as "null" so the effect can
      // distinguish "user chose browser mode" from "no preference yet".
      localStorage.setItem(STORAGE_KEY, JSON.stringify(id))
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
