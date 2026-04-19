import { useCallback } from 'react'
import { useAppDispatch } from '@/store/hooks'
import { cloudAxios, cloudApiConfig } from '@/lib/cloud-api'
import {
  setInfoFetchStatus,
  setInfoFetchUrl,
  setInfoFetchResult,
  type OpenApiInfoResult,
} from '@/store/newApiWizardSlice'

export function useApiInfo() {
  const dispatch = useAppDispatch()

  const fetchInfo = useCallback(
    async (url: string) => {
      dispatch(setInfoFetchStatus('loading'))
      dispatch(setInfoFetchUrl(url))
      dispatch(setInfoFetchResult(null))
      try {
        const { data } = await cloudAxios.get<OpenApiInfoResult>(
          `${cloudApiConfig.basePath}/apis/info`,
          { params: { openapi_doc_url: url } },
        )
        dispatch(setInfoFetchResult(data))
        dispatch(setInfoFetchStatus('success'))
      } catch {
        dispatch(setInfoFetchStatus('error'))
      }
    },
    [dispatch],
  )

  const clearInfo = useCallback(() => {
    dispatch(setInfoFetchStatus('idle'))
    dispatch(setInfoFetchUrl(null))
    dispatch(setInfoFetchResult(null))
  }, [dispatch])

  return { fetchInfo, clearInfo }
}
