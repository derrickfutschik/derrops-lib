import { ServiceApi } from '@/client/derrops-cloud'
import type { Service } from '@/client/derrops-cloud/models/service'
import { cloudApiConfig, cloudAxios } from '@/lib/cloud-api'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

export function useServices() {
  const serviceApi = useMemo(() => new ServiceApi(cloudApiConfig, undefined, cloudAxios), [])

  return useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => {
      const { data } = await serviceApi.serviceControllerFindAll()
      return data
    },
  })
}
