import { API_BASE_URL } from '@/config'
import {
  AegisInstanceApi,
  Configuration,
  RelayInstanceApi,
} from '@/client/slaops-cloud'
import type {
  AegisCreateResponseDto,
  AegisInstance,
  CreateAegisInstanceDto,
  CreateRelayInstanceDto,
  RelayInstance,
  UpdateAegisInstanceDto,
  UpdateRelayInstanceDto,
} from '@/client/slaops-cloud'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAuthSession } from 'aws-amplify/auth'
import { useMemo } from 'react'

// TODO: Replace with actual tenant ID from auth context
const TENANT_ID = 'default-tenant'

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const session = await fetchAuthSession()
    const token = session.tokens?.idToken?.toString()
    if (token) {
      return { Authorization: `Bearer ${token}` }
    }
  } catch {
    // not authenticated
  }
  return {}
}

function useApiClients() {
  return useMemo(() => {
    const config = new Configuration({
      basePath: API_BASE_URL,
    })
    return {
      relayApi: new RelayInstanceApi(config),
      aegisApi: new AegisInstanceApi(config),
    }
  }, [])
}

// ── Relay Hooks ──

export function useRelayInstances() {
  const { relayApi } = useApiClients()
  return useQuery<RelayInstance[]>({
    queryKey: ['relay-instances'],
    queryFn: async () => {
      const headers = await getAuthHeaders()
      const { data } = await relayApi.relayInstanceControllerFindAll(TENANT_ID, { headers })
      return data
    },
  })
}

export function useCreateRelay() {
  const { relayApi } = useApiClients()
  const qc = useQueryClient()
  return useMutation<RelayInstance, Error, CreateRelayInstanceDto>({
    mutationFn: async (dto) => {
      const headers = await getAuthHeaders()
      const { data } = await relayApi.relayInstanceControllerCreate(TENANT_ID, dto, { headers })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['relay-instances'] }),
  })
}

export function useUpdateRelay() {
  const { relayApi } = useApiClients()
  const qc = useQueryClient()
  return useMutation<RelayInstance, Error, { id: string; dto: UpdateRelayInstanceDto }>({
    mutationFn: async ({ id, dto }) => {
      const headers = await getAuthHeaders()
      const { data } = await relayApi.relayInstanceControllerUpdate(TENANT_ID, id, dto, { headers })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['relay-instances'] }),
  })
}

export function useDeleteRelay() {
  const { relayApi } = useApiClients()
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const headers = await getAuthHeaders()
      await relayApi.relayInstanceControllerRemove(TENANT_ID, id, { headers })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['relay-instances'] }),
  })
}

export function useHealthCheckRelay() {
  const { relayApi } = useApiClients()
  const qc = useQueryClient()
  return useMutation<RelayInstance, Error, string>({
    mutationFn: async (id) => {
      const headers = await getAuthHeaders()
      const { data } = await relayApi.relayInstanceControllerHealthCheck(TENANT_ID, id, { headers })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['relay-instances'] }),
  })
}

// ── Aegis Hooks ──

export function useAegisInstances() {
  const { aegisApi } = useApiClients()
  return useQuery<AegisInstance[]>({
    queryKey: ['aegis-instances'],
    queryFn: async () => {
      const headers = await getAuthHeaders()
      const { data } = await aegisApi.aegisInstanceControllerFindAll(TENANT_ID, { headers })
      return data
    },
  })
}

export function useCreateAegis() {
  const { aegisApi } = useApiClients()
  const qc = useQueryClient()
  return useMutation<AegisCreateResponseDto, Error, CreateAegisInstanceDto>({
    mutationFn: async (dto) => {
      const headers = await getAuthHeaders()
      const { data } = await aegisApi.aegisInstanceControllerCreate(TENANT_ID, dto, { headers })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aegis-instances'] }),
  })
}

export function useUpdateAegis() {
  const { aegisApi } = useApiClients()
  const qc = useQueryClient()
  return useMutation<AegisInstance, Error, { id: string; dto: UpdateAegisInstanceDto }>({
    mutationFn: async ({ id, dto }) => {
      const headers = await getAuthHeaders()
      const { data } = await aegisApi.aegisInstanceControllerUpdate(TENANT_ID, id, dto, { headers })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aegis-instances'] }),
  })
}

export function useDeleteAegis() {
  const { aegisApi } = useApiClients()
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const headers = await getAuthHeaders()
      await aegisApi.aegisInstanceControllerRemove(TENANT_ID, id, { headers })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aegis-instances'] }),
  })
}

export function useHealthCheckAegis() {
  const { aegisApi } = useApiClients()
  const qc = useQueryClient()
  return useMutation<AegisInstance, Error, string>({
    mutationFn: async (id) => {
      const headers = await getAuthHeaders()
      const { data } = await aegisApi.aegisInstanceControllerHealthCheck(TENANT_ID, id, { headers })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aegis-instances'] }),
  })
}
