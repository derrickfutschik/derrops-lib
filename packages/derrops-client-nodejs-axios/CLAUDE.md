# derrops-client-nodejs-axios

Production-ready Axios interceptor client for Node.js/TypeScript. Automatically captures HTTP request/response data and forwards it to the Derrops platform with minimal overhead.

**Status**: Public (published to npm)  
**Depends on**: `@derrops/private`, `@derrops/client`

## Features

- Automatic capture via Axios request/response interceptors
- Configurable header redaction (regex patterns)
- Optional request/response body capture (off by default)
- Internal request prevention (no recursive interception)

## Usage

```typescript
import axios from 'axios'
import { attachDerropsInterceptor } from 'derrops-client-nodejs-axios'

const api = axios.create({ baseURL: 'https://api.example.com' })

attachDerropsInterceptor(api, {
  endpoint: config['derrops.endpoint'],
  apiKey: config['derrops.apiKey'],
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
