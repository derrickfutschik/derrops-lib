# slaops-client-nodejs-axios

Production-ready Axios interceptor client for Node.js/TypeScript. Automatically captures HTTP request/response data and forwards it to the SLAOps platform with minimal overhead.

**Status**: Public (published to npm)  
**Depends on**: `@slaops/private`, `@slaops/client`

## Features

- Automatic capture via Axios request/response interceptors
- Configurable header redaction (regex patterns)
- Optional request/response body capture (off by default)
- Internal request prevention (no recursive interception)

## Usage

```typescript
import axios from 'axios'
import { attachSlaOpsInterceptor } from 'slaops-client-nodejs-axios'

const api = axios.create({ baseURL: 'https://api.example.com' })

attachSlaOpsInterceptor(api, {
  endpoint: config['slaops.endpoint'],
  apiKey: config['slaops.apiKey'],
  projectId: 'my-project',
  redactHeaders: [/authorization/i, /cookie/i],
  includeRequestBody: false,
  includeResponseBody: false,
})
```

## Commands

```bash
pnpm run build       # Build with tsup (ESM + CJS + .d.ts)
pnpm run dev         # Watch mode
pnpm run test        # Vitest
pnpm run test:watch  # Vitest watch
```
