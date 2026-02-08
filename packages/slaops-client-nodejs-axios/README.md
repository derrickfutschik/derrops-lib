# slaops-client-nodejs-axios

An **Axios-only** client for sending SLA Ops events (requests, responses, metrics) from Node.js/TypeScript apps.
Ships with a tiny client and a one-call **interceptor** to auto-capture Axios requests/responses and forward
them to your SLA Ops collector.

## Install

```bash
npm i slaops-client-nodejs-axios axios
# or
pnpm add slaops-client-nodejs-axios axios
```

## Two ways to use

### 1) Register an interceptor (recommended)

```ts
import axios from 'axios'
import { attachSlaOpsInterceptor } from 'slaops-client-nodejs-axios'

const api = axios.create({ baseURL: 'https://api.example.com' })

attachSlaOpsInterceptor(api, {
  endpoint: process.env.SLAOPS_ENDPOINT!, // e.g. https://collector.example.com/v1/events
  apiKey: process.env.SLAOPS_API_KEY,
  projectId: 'my-project',
  // optional:
  redactHeaders: [/authorization/i, /cookie/i],
  includeRequestBody: false, // defaults false
  includeResponseBody: false, // defaults false
})

await api.get('/items?limit=10')
```

The interceptor builds a minimal `HttpEvent` and posts it to your collector. It uses a separate internal Axios instance and adds the header `x-slaops-internal: 1` to avoid recursive interception.

### 2) Call the client directly

```ts
import { SlaOpsClient, type HttpEvent } from 'slaops-client-nodejs-axios'

const client = new SlaOpsClient({
  endpoint: process.env.SLAOPS_ENDPOINT!,
  apiKey: process.env.SLAOPS_API_KEY,
  projectId: 'my-project',
})

const evt: HttpEvent = {
  request: {
    method: 'GET',
    url: {
      href: 'https://api.example.com/items?limit=10',
      origin: 'https://api.example.com',
      host: 'api.example.com',
      pathname: '/items',
    },
    headers: { 'user-agent': 'demo' },
  },
  response: { status: 200 },
  info: {
    bodySize: 0,
    truncation: 'NONE',
    bodyHash: '',
    pathHash: '',
    queryParamsHash: '',
    createdAt: Date.now(),
    id: crypto.randomUUID(),
  },
}

await client.sendEvent(evt)
```

## License

MIT
