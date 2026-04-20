import { cloudApiConfig, cloudAxios } from '@/lib/cloud-api'
import { useAppDispatch } from '@/store/hooks'
import {
  setInfoFetchResult,
  setInfoFetchStatus,
  setInfoFetchUrl,
  type OpenApiInfoResult,
} from '@/store/newApiWizardSlice'
import { useCallback } from 'react'

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
