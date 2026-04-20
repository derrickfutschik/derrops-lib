/**
 * @designDoc apps/slaops-docs/internal/platform/design/openapi-indexer/views/parameters-tab.md
 */
import { API_BASE_URL, PAGE_SIZE } from '@/config'
import { cloudAxios } from '@/lib/cloud-api'
import { selectParametersTabState, selectSelectedVersion } from '@/store/apiTabsSlice'
import { useAppSelector } from '@/store/hooks'
import type { PagedResult, ParameterHit } from '@/types/apiTabs'
import { useQuery } from '@tanstack/react-query'

export function useParametersTab(apiId: string) {
  const { sort, page, query, locationFilter } = useAppSelector(selectParametersTabState)
  const selectedVersion = useAppSelector(selectSelectedVersion)
  const from = page * PAGE_SIZE

  return useQuery<PagedResult<ParameterHit>>({
    queryKey: ['api-tabs', apiId, 'parameters', selectedVersion, sort, page, query, locationFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        version: selectedVersion ?? 'latest',
        from: String(from),
        size: String(PAGE_SIZE),
        sort: sort.field,
        order: sort.direction,
      })
      if (query) params.set('q', query)
      if (locationFilter) params.set('location', locationFilter)
      const { data } = await cloudAxios.get<PagedResult<ParameterHit>>(
        `${API_BASE_URL}/openapi/api/${apiId}/parameters?${params}`,
      )
      return data
    },
    enabled: !!apiId,
  })
}
