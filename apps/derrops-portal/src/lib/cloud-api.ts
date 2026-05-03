import { Configuration } from '@/client/derrops-cloud'
import { API_BASE_URL } from '@/config'
import { fetchAuthSession } from 'aws-amplify/auth'
import axios from 'axios'

/**
 * Axios instance shared by all generated derrops-cloud API clients.
 * The request interceptor attaches the Cognito access token as
 * `Authorization: Bearer <token>` on every outgoing request.
 */
export const cloudAxios = axios.create()

cloudAxios.interceptors.request.use(async (config) => {
  try {
    const session = await fetchAuthSession()
    const token = session.tokens?.accessToken?.toString()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch {
    // unauthenticated — let the request proceed without a token
  }
  return config
})

/**
 * Pre-built Configuration for all derrops-cloud API clients.
 * Pass this (and cloudAxios) to every generated API constructor:
 *
 *   new ServiceApi(cloudApiConfig, undefined, cloudAxios)
 */
export const cloudApiConfig = new Configuration({ basePath: API_BASE_URL })
