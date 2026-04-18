import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ServiceApi } from '@/client/slaops-cloud'
import type { Service } from '@/client/slaops-cloud/models/service'
import { cloudApiConfig, cloudAxios } from '@/lib/cloud-api'

export function useServices() {
  const serviceApi = useMemo(
    () => new ServiceApi(cloudApiConfig, undefined, cloudAxios),
    [],
  )

  return useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: async () => {
      const { data } = await serviceApi.serviceControllerFindAll()
      return data
    },
  })
}
