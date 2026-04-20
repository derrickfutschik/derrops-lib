/**
 * @designDoc apps/slaops-docs/internal/platform/design/openapi-indexer/views/operations-tab.md
 */
import { useQuery } from '@tanstack/react-query'
import { cloudAxios } from '@/lib/cloud-api'
import { API_BASE_URL, PAGE_SIZE } from '@/config'
import { useAppSelector } from '@/store/hooks'
import { selectOperationsTabState, selectSelectedVersion } from '@/store/apiTabsSlice'
import type { PagedResult, OperationHit } from '@/types/apiTabs'

export function useOperationsTab(apiId: string) {
  const { sort, page, query, methodFilter, tagFilter } = useAppSelector(selectOperationsTabState)
  const selectedVersion = useAppSelector(selectSelectedVersion)
  const from = page * PAGE_SIZE

  return useQuery<PagedResult<OperationHit>>({
    queryKey: ['api-tabs', apiId, 'operations', selectedVersion, sort, page, query, methodFilter, tagFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        version: selectedVersion ?? 'latest',
        from: String(from),
        size: String(PAGE_SIZE),
        sort: sort.field,
        order: sort.direction,
      })
      if (query) params.set('q', query)
      if (methodFilter.length) params.set('method', methodFilter.join(','))
      if (tagFilter) params.set('tag', tagFilter)
      const { data } = await cloudAxios.get<PagedResult<OperationHit>>(
        `${API_BASE_URL}/openapi/api/${apiId}/operations?${params}`,
      )
      return data
    },
    enabled: !!apiId,
  })
}
