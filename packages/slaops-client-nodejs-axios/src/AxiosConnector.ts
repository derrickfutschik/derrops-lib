import { createHarLog, RawRequest, RawResponse } from "@slaops/lib";
import { AxiosInstance, AxiosRequestConfig, AxiosStatic, InternalAxiosRequestConfig } from "axios";




export function createHttpRequest(config: InternalAxiosRequestConfig, extraHeaders?: { [k: string]: any }): RawRequest {

    const headers = Object.entries((extraHeaders !== undefined ? { ...extraHeaders, ...config.headers } : config.headers))
        .filter(([key, value]) =>
            !(value instanceof Function) && !Array.isArray(value)
        )
        .map(([key, value]) => ({ [key]: value }))
        .reduce((b, a) => ({ ...b, ...a }))
    // .map(([key, value]) => {headers[key as keyof ObjectType] = value})

    return {
        ...config,
        httpVersion: config.httpVersion ? config.httpVersion.toString() : undefined,
        url: new URL(config.url!),
        method: config.method as string,
        headers,
        body: config.data && JSON.stringify(JSON.parse(config.data).body, null, 2),
    }
}


export function addInterceptor(instance: AxiosStatic | AxiosInstance) {

    instance.interceptors.request.use((config) => {
        config.headers['restops-request-startTime'] = new Date().getTime();
        config.headers['content-type'] = config.headers['content-type'] ?? "application/json"
        // @ts-ignore
        config.meta = config
        return config
    })

    instance.interceptors.response.use(async (response) => {

        const currentTime = new Date().getTime()
        const startTime = parseInt(response.config.headers['restops-request-startTime'])
        const duration = currentTime - startTime

        response.headers['restops-duration'] = currentTime - startTime

        console.log({ duration })

        // @ts-ignore
        const originalRequest = response.config.meta

        const httpRequest: RawRequest = {
            ...createHttpRequest(originalRequest),
            startedDateTime: new Date(startTime).toISOString(),
            time: duration,
        }
        const httpResponse: RawResponse = {
            ...createHttpRequest(response.config!, { ...response.config.headers, ...response.headers }),
            status: response.status,
            statusText: response.statusText ?? '',
            size: response.data?.length ?? 0,
            mimeType: response.headers['content-type']
        }

        const harLog = createHarLog(httpRequest, httpResponse)
        console.log(JSON.stringify(harLog))


        return response
    })

}