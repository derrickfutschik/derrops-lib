import { createHarLog, RawRequest, RawResponse } from "@slaops/lib";
import { AxiosInstance, AxiosStatic, InternalAxiosRequestConfig } from "axios";


export function createHttpRequest(config: InternalAxiosRequestConfig | undefined, extraHeaders?: { [k: string]: any }): RawRequest {
    if (!config) {
        throw new Error('config is required');
    }

    const headers = Object.entries((extraHeaders !== undefined ? { ...extraHeaders, ...(config.headers ?? {}) } : config.headers ?? {}))
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
        method: (config.method as string).toUpperCase(),
        headers,
        body: config.data && JSON.stringify(JSON.parse(config.data).body, null, 2),
        queryParams: config.params,
    }
}

function normalizeHeaders(headers: Record<string, any>): Record<string, any> {
    return Object.entries(headers)
        .filter(([key, value]) =>
            !(value instanceof Function) && !Array.isArray(value)
        )
        .map(([key, value]) => ({ [key]: value }))
        .reduce((b, a) => ({ ...b, ...a }), {});
}


export function addInterceptor(instance: AxiosStatic | AxiosInstance) {

    instance.interceptors.request.use((config) => {
        (config as any).start = { start: new Date() };
        (config as any).har = { startTime: performance.now() };

        return config
    })

    instance.interceptors.response.use(async (response) => {

        const start = (response.config as any).start;
        const harData = (response.config as any).har;
        const endTime = performance.now();
        const startTime = harData.startTime
        const total = endTime - harData.startTime;


        // console.log({ duration })

        // @ts-ignore
        const originalRequest = response.config.meta || response.config

        const httpRequest: RawRequest = {
            ...createHttpRequest(originalRequest),
            startedDateTime: new Date(startTime).toISOString(),
            time: total,
        }
        const httpResponse: RawResponse = {
            status: response.status,
            statusText: response.statusText ?? '',
            headers: normalizeHeaders(response.headers),
            size: response.data?.length ?? 0,
            mimeType: response.headers['content-type']
        }

        const harLog = {
            ...createHarLog(httpRequest, httpResponse),
            startedDateTime: start.start.toISOString(),
        }
        console.log(JSON.stringify(harLog, null, 2))


        return response
    })

}