import { AxiosInstance, AxiosRequestConfig } from "axios";
import {
    HttpHandler,
    HttpRequest,
    HttpResponse,
} from "@aws-sdk/protocol-http";
import { HttpHandlerOptions } from "@aws-sdk/types";

export class AxiosHttpHandler implements HttpHandler {

    // You can pass in a pre-configured Axios instance
    constructor(private readonly axiosInstance: AxiosInstance, private readonly axiosConfig?: AxiosRequestConfig) { }

    destroy(): void {
        // no-op, unless you want to tear down keep-alive agents etc.
    }

    async handle(
        request: HttpRequest,
        options: HttpHandlerOptions = {}
    ): Promise<{ response: HttpResponse }> {
        // Include port number if specified (e.g., for LocalStack on port 4566)
        const port = request.port ? `:${request.port}` : '';
        const url = `${request.protocol}//${request.hostname}${port}${request.path}`;

        // Convert AWS headers (HeaderBag) to plain object
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(request.headers)) {
            if (typeof value === "string") headers[key] = value;
        }

        const axiosRequest: AxiosRequestConfig = {
            method: request.method.toLowerCase() as any,
            url,
            headers,
            data: request.body,
            timeout: options.requestTimeout, // SDK passes ms timeout here
            responseType: 'stream', // AWS SDK expects a stream for Node.js
            ...this.axiosConfig,
            // You can merge/override things from axiosConfig here as needed
        };

        const res = await this.axiosInstance(axiosRequest);

        const awsResponse = new HttpResponse({
            statusCode: res.status,
            reason: res.statusText,
            headers: res.headers as Record<string, string>,
            body: res.data, // Stream for Node.js
        });

        return { response: awsResponse };
    }
}

