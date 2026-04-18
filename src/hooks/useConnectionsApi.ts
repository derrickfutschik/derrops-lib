import type {
  AegisCreateResponseDto,
  AegisInstance,
  CloudRelayConnection,
  CreateAegisInstanceDto,
  CreateCloudRelayConnectionDto,
  CreateRelayInstanceDto,
  RelayInstance,
  UpdateAegisInstanceDto,
  UpdateRelayInstanceDto,
} from '@/client/slaops-cloud'
import { AegisInstanceApi, CloudRelayApi, RelayInstanceApi } from '@/client/slaops-cloud'
import { API_BASE_URL } from '@/config'
import { cloudApiConfig, cloudAxios } from '@/lib/cloud-api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

// Types for new endpoints not yet in the generated client
export interface CreateConnectionResponse extends CloudRelayConnection {
  iam_access_key_id_created?: string
  iam_secret_access_key?: string
  aegis_registration_token?: string
}

export interface UpdateConnectionDto {
  name?: string
  url?: string
  aegis_id?: string | null
}

function useApiClients() {
  return useMemo(
    () => ({
      relayApi: new RelayInstanceApi(cloudApiConfig, undefined, cloudAxios),
      aegisApi: new AegisInstanceApi(cloudApiConfig, undefined, cloudAxios),
      cloudRelayApi: new CloudRelayApi(cloudApiConfig, undefined, cloudAxios),
    }),
    [],
  )
}

// ── Relay Hooks ──

export function useRelayInstances() {
  const { relayApi } = useApiClients()
  return useQuery<RelayInstance[]>({
    queryKey: ['relay-instances'],
    queryFn: async () => {
      const { data } = await relayApi.relayInstanceControllerFindAll()
      return data
    },
  })
}

export function useCreateRelay() {
  const { relayApi } = useApiClients()
  const qc = useQueryClient()
  return useMutation<RelayInstance, Error, CreateRelayInstanceDto>({
    mutationFn: async (dto) => {
      const { data } = await relayApi.relayInstanceControllerCreate(dto)
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
      const { data } = await relayApi.relayInstanceControllerUpdate(id, dto)
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
      await relayApi.relayInstanceControllerRemove(id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['relay-instances'] }),
  })
}

export function useHealthCheckRelay() {
  const { relayApi } = useApiClients()
  const qc = useQueryClient()
  return useMutation<RelayInstance, Error, string>({
    mutationFn: async (id) => {
      const { data } = await relayApi.relayInstanceControllerHealthCheck(id)
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
      const { data } = await aegisApi.aegisInstanceControllerFindAll()
      return data
    },
  })
}

export function useCreateAegis() {
  const { aegisApi } = useApiClients()
  const qc = useQueryClient()
  return useMutation<AegisCreateResponseDto, Error, CreateAegisInstanceDto>({
    mutationFn: async (dto) => {
      const { data } = await aegisApi.aegisInstanceControllerCreate(dto)
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
      const { data } = await aegisApi.aegisInstanceControllerUpdate(id, dto)
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
      await aegisApi.aegisInstanceControllerRemove(id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aegis-instances'] }),
  })
}

export function useHealthCheckAegis() {
  const { aegisApi } = useApiClients()
  const qc = useQueryClient()
  return useMutation<AegisInstance, Error, string>({
    mutationFn: async (id) => {
      const { data } = await aegisApi.aegisInstanceControllerHealthCheck(id)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aegis-instances'] }),
  })
}

// ── CloudRelayConnection Hooks ──

export function useConnections() {
  const { cloudRelayApi } = useApiClients()
  return useQuery<CloudRelayConnection[]>({
    queryKey: ['connections'],
    queryFn: async () => {
      const { data } = await cloudRelayApi.cloudRelayControllerFindAllConnections()
      return data
    },
  })
}

export function useCreateConnection() {
  const qc = useQueryClient()
  return useMutation<CreateConnectionResponse, Error, CreateCloudRelayConnectionDto>({
    mutationFn: async (dto) => {
      const { data } = await cloudAxios.post<CreateConnectionResponse>(
        `${API_BASE_URL}/cloud-relay/connection`,
        dto,
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  })
}

export function useUpdateConnection() {
  const qc = useQueryClient()
  return useMutation<CloudRelayConnection, Error, { id: string; dto: UpdateConnectionDto }>({
    mutationFn: async ({ id, dto }) => {
      const { data } = await cloudAxios.patch<CloudRelayConnection>(
        `${API_BASE_URL}/cloud-relay/connection/${id}`,
        dto,
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  })
}

export function useDeleteConnection() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await cloudAxios.delete(`${API_BASE_URL}/cloud-relay/connection/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  })
}

export function useHealthCheckConnection() {
  const qc = useQueryClient()
  return useMutation<{ reachable: boolean; latencyMs?: number; error?: string }, Error, string>({
    mutationFn: async (id) => {
      const { data } = await cloudAxios.post<{
        reachable: boolean
        latencyMs?: number
        error?: string
      }>(`${API_BASE_URL}/cloud-relay/connection/${id}/health-check`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  })
}

export function useTestQueueConnection() {
  return useMutation<{ sent: boolean; error?: string }, Error, string>({
    mutationFn: async (id) => {
      const { data } = await cloudAxios.post<{ sent: boolean; error?: string }>(
        `${API_BASE_URL}/cloud-relay/connection/${id}/test-queue`,
      )
      return data
    },
  })
}
