import type { AdoptApiDto, ApiEntity, CreateApiDto, UpdateApiDto } from '@/client/derrops-cloud'
import { APIApi } from '@/client/derrops-cloud'
import { cloudApiConfig, cloudAxios } from '@/lib/cloud-api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

function useApisClient() {
  return useMemo(() => new APIApi(cloudApiConfig, undefined, cloudAxios), [])
}

export function useApis() {
  const client = useApisClient()
  return useQuery<ApiEntity[]>({
    queryKey: ['apis'],
    queryFn: async () => {
      const { data } = await client.apiControllerFindAll()
      return data
    },
  })
}

export function useApi(id: string) {
  const client = useApisClient()
  return useQuery<ApiEntity>({
    queryKey: ['apis', id],
    queryFn: async () => {
      const { data } = await client.apiControllerFindOne(id)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateApi() {
  const client = useApisClient()
  const queryClient = useQueryClient()
  return useMutation<ApiEntity, Error, CreateApiDto>({
    mutationFn: async (dto) => {
      const { data } = await client.apiControllerCreate(dto)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apis'] }),
  })
}

export function useUpdateApi() {
  const client = useApisClient()
  const queryClient = useQueryClient()
  return useMutation<ApiEntity, Error, { id: string; dto: UpdateApiDto }>({
    mutationFn: async ({ id, dto }) => {
      const { data } = await client.apiControllerUpdate(id, dto)
      return data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['apis'] })
      queryClient.invalidateQueries({ queryKey: ['apis', id] })
    },
  })
}

export function useDeleteApi() {
  const client = useApisClient()
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await client.apiControllerRemove(id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apis'] }),
  })
}

export function useAdoptApi() {
  const client = useApisClient()
  const queryClient = useQueryClient()
  return useMutation<ApiEntity, Error, AdoptApiDto>({
    mutationFn: async (dto) => {
      const { data } = await client.apiControllerAdopt(dto)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apis'] }),
  })
}
