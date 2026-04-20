import { ServiceApi } from '@/client/slaops-cloud'
import type { Service } from '@/client/slaops-cloud/models/service'
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
