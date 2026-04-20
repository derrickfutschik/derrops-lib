/**
 * @designDoc apps/slaops-docs/internal/platform/design/openapi-indexer/views/models-tab.md
 */
import { useQuery } from '@tanstack/react-query'
import { cloudAxios } from '@/lib/cloud-api'
import { API_BASE_URL, PAGE_SIZE } from '@/config'
import { useAppSelector } from '@/store/hooks'
import { selectModelsTabState, selectSelectedVersion } from '@/store/apiTabsSlice'
import type { PagedResult, ModelHit } from '@/types/apiTabs'

export function useModelsTab(apiId: string) {
  const { sort, page, query, usedInFilter } = useAppSelector(selectModelsTabState)
  const selectedVersion = useAppSelector(selectSelectedVersion)
  const from = page * PAGE_SIZE

  return useQuery<PagedResult<ModelHit>>({
    queryKey: ['api-tabs', apiId, 'models', selectedVersion, sort, page, query, usedInFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        version: selectedVersion ?? 'latest',
        from: String(from),
        size: String(PAGE_SIZE),
        sort: sort.field,
        order: sort.direction,
      })
      if (query) params.set('q', query)
      if (usedInFilter) params.set('usedIn', usedInFilter)
      const { data } = await cloudAxios.get<PagedResult<ModelHit>>(
        `${API_BASE_URL}/openapi/api/${apiId}/models?${params}`,
      )
      return data
    },
    enabled: !!apiId,
  })
}
