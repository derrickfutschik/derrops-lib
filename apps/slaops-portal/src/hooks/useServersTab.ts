/**
 * @designDoc apps/slaops-docs/internal/platform/design/openapi-indexer/views/servers-tab.md
 */
import { API_BASE_URL, PAGE_SIZE } from '@/config'
import { cloudAxios } from '@/lib/cloud-api'
import { selectSelectedVersion, selectServersTabState } from '@/store/apiTabsSlice'
import { useAppSelector } from '@/store/hooks'
import type { PagedResult, ServerHit } from '@/types/apiTabs'
import { useQuery } from '@tanstack/react-query'

export function useServersTab(apiId: string) {
  const { sort, page } = useAppSelector(selectServersTabState)
  const selectedVersion = useAppSelector(selectSelectedVersion)
  const from = page * PAGE_SIZE

  return useQuery<PagedResult<ServerHit>>({
    queryKey: ['api-tabs', apiId, 'servers', selectedVersion, sort, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        version: selectedVersion ?? 'latest',
        from: String(from),
        size: String(PAGE_SIZE),
        sort: sort.field,
        order: sort.direction,
      })
      const { data } = await cloudAxios.get<PagedResult<ServerHit>>(
        `${API_BASE_URL}/openapi/api/${apiId}/servers?${params}`,
      )
      return data
    },
    enabled: !!apiId,
  })
}
