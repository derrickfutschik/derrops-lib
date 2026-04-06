import {
  AegisInstanceApi,
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
import { cloudApiConfig, cloudAxios } from '@/lib/cloud-api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchAuthSession } from 'aws-amplify/auth'

async function getTenantId(): Promise<string> {
  const session = await fetchAuthSession()
  const tenantId = session.tokens?.idToken?.payload['custom:tenant_id']
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('No tenant ID found in auth session — ensure you are signed in')
  }
  return tenantId
}

function useApiClients() {
  return useMemo(() => ({
    relayApi: new RelayInstanceApi(cloudApiConfig, undefined, cloudAxios),
    aegisApi: new AegisInstanceApi(cloudApiConfig, undefined, cloudAxios),
  }), [])
}

// ── Relay Hooks ──

export function useRelayInstances() {
  const { relayApi } = useApiClients()
  return useQuery<RelayInstance[]>({
    queryKey: ['relay-instances'],
    queryFn: async () => {
      const tenantId = await getTenantId()
      const { data } = await relayApi.relayInstanceControllerFindAll(tenantId)
      return data
    },
  })
}

export function useCreateRelay() {
  const { relayApi } = useApiClients()
  const qc = useQueryClient()
  return useMutation<RelayInstance, Error, CreateRelayInstanceDto>({
    mutationFn: async (dto) => {
      const tenantId = await getTenantId()
      const { data } = await relayApi.relayInstanceControllerCreate(tenantId, dto)
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
      const tenantId = await getTenantId()
      const { data } = await relayApi.relayInstanceControllerUpdate(tenantId, id, dto)
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
      const tenantId = await getTenantId()
      await relayApi.relayInstanceControllerRemove(tenantId, id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['relay-instances'] }),
  })
}

export function useHealthCheckRelay() {
  const { relayApi } = useApiClients()
  const qc = useQueryClient()
  return useMutation<RelayInstance, Error, string>({
    mutationFn: async (id) => {
      const tenantId = await getTenantId()
      const { data } = await relayApi.relayInstanceControllerHealthCheck(tenantId, id)
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
      const tenantId = await getTenantId()
      const { data } = await aegisApi.aegisInstanceControllerFindAll(tenantId)
      return data
    },
  })
}

export function useCreateAegis() {
  const { aegisApi } = useApiClients()
  const qc = useQueryClient()
  return useMutation<AegisCreateResponseDto, Error, CreateAegisInstanceDto>({
    mutationFn: async (dto) => {
      const tenantId = await getTenantId()
      const { data } = await aegisApi.aegisInstanceControllerCreate(tenantId, dto)
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
      const tenantId = await getTenantId()
      const { data } = await aegisApi.aegisInstanceControllerUpdate(tenantId, id, dto)
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
      const tenantId = await getTenantId()
      await aegisApi.aegisInstanceControllerRemove(tenantId, id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aegis-instances'] }),
  })
}

export function useHealthCheckAegis() {
  const { aegisApi } = useApiClients()
  const qc = useQueryClient()
  return useMutation<AegisInstance, Error, string>({
    mutationFn: async (id) => {
      const tenantId = await getTenantId()
      const { data } = await aegisApi.aegisInstanceControllerHealthCheck(tenantId, id)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aegis-instances'] }),
  })
}
