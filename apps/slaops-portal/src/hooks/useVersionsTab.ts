/**
 * @designDoc apps/slaops-docs/internal/platform/design/openapi-indexer/views/versions-tab.md
 */
import { useQuery } from '@tanstack/react-query'
import { cloudAxios } from '@/lib/cloud-api'
import { API_BASE_URL, PAGE_SIZE } from '@/config'
import { useAppSelector } from '@/store/hooks'
import { selectVersionsTabState } from '@/store/apiTabsSlice'
import type { PagedResult, VersionHit } from '@/types/apiTabs'

export function useVersionsTab(apiId: string) {
  const { sort, page } = useAppSelector(selectVersionsTabState)
  const from = page * PAGE_SIZE

  return useQuery<PagedResult<VersionHit>>({
    queryKey: ['api-tabs', apiId, 'versions', sort, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: String(from),
        size: String(PAGE_SIZE),
        sort: sort.field,
        order: sort.direction,
      })
      const { data } = await cloudAxios.get<PagedResult<VersionHit>>(
        `${API_BASE_URL}/openapi/api/${apiId}/versions?${params}`,
      )
      return data
    },
    enabled: !!apiId,
  })
}
