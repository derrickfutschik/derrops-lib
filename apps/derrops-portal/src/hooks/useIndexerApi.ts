import { OpenAPIIndexerApi } from '@/client/derrops-cloud'
import { cloudApiConfig, cloudAxios } from '@/lib/cloud-api'
import type { CatalogueResponse, IndexingResponse, PresignedUrlResult } from '@/types/indexer'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

function useIndexerClient() {
  return useMemo(() => new OpenAPIIndexerApi(cloudApiConfig, undefined, cloudAxios), [])
}

export function useUploadUrl() {
  const client = useIndexerClient()
  return useMutation<PresignedUrlResult, Error, { apiId: string; key: string }>({
    mutationFn: async (params) => {
      const { data } = await client.openApiIndexerControllerGetUploadUrl(params)
      return data as unknown as PresignedUrlResult
    },
  })
}

export function useIndexSpec() {
  const client = useIndexerClient()
  return useMutation<IndexingResponse, Error, { apiId: string; bucket: string; key: string }>({
    mutationFn: async (params) => {
      const { data } = await client.openApiIndexerControllerIndexFromS3(params)
      return data as unknown as IndexingResponse
    },
  })
}

export function useCatalogue(q: string, limit = 10) {
  const client = useIndexerClient()
  return useQuery<CatalogueResponse>({
    queryKey: ['catalogue', q, limit],
    queryFn: async () => {
      const { data } = await client.openApiIndexerControllerSearchCatalogue(0, limit, q)
      return data as unknown as CatalogueResponse
    },
  })
}
