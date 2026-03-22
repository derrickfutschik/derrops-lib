/**
 * Generates request representations in various formats (HTTP, cURL, Node.js axios, HAR).
 */

export interface RequestData {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
}

export type RequestFormat = 'http' | 'curl' | 'axios' | 'har'

export const REQUEST_FORMAT_LABELS: Record<RequestFormat, string> = {
  http: 'HTTP',
  curl: 'cURL',
  axios: 'Node.js (axios)',
  har: 'HAR',
}

export const REQUEST_FORMAT_LANGUAGES: Record<RequestFormat, string> = {
  http: 'http',
  curl: 'bash',
  axios: 'javascript',
  har: 'json',
}

// ---------------------------------------------------------------------------
// HTTP raw format
// ---------------------------------------------------------------------------
export function toHttpRaw(req: RequestData): string {
  const { method, url, headers, body } = req
  let urlObj: URL | null = null
  try {
    urlObj = new URL(url)
  } catch {
    // fallback – just use the raw string
  }

  const path = urlObj ? `${urlObj.pathname}${urlObj.search}` : url
  const host = urlObj?.host ?? ''

  const lines: string[] = [`${method} ${path} HTTP/1.1`]
  if (host) lines.push(`Host: ${host}`)
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === 'host') continue
    lines.push(`${k}: ${v}`)
  }
  lines.push('')
  if (body) lines.push(body)
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// cURL
// ---------------------------------------------------------------------------
function shellEscape(s: string): string {
  if (!/[^a-zA-Z0-9@%+=:,./-]/.test(s)) return s
  return "'" + s.replace(/'/g, "'\\''") + "'"
}

export function toCurl(req: RequestData): string {
  const { method, url, headers, body } = req
  const parts: string[] = ['curl']

  if (method !== 'GET') {
    parts.push(`-X ${method}`)
  }

  parts.push(shellEscape(url))

  for (const [k, v] of Object.entries(headers)) {
    parts.push(`-H ${shellEscape(`${k}: ${v}`)}`)
  }

  if (body) {
    // Try to detect JSON for pretty formatting
    parts.push(`-d ${shellEscape(body)}`)
  }

  return parts.join(' \\\n  ')
}

// ---------------------------------------------------------------------------
// Node.js axios
// ---------------------------------------------------------------------------
export function toAxios(req: RequestData): string {
  const { method, url, headers, body } = req

  const headerEntries = Object.entries(headers)
  const hasHeaders = headerEntries.length > 0
  const hasBody = !!body

  // Try to parse body as JSON for cleaner output
  let bodyExpr: string | null = null
  if (hasBody) {
    try {
      const parsed = JSON.parse(body!)
      bodyExpr = JSON.stringify(parsed, null, 2)
    } catch {
      bodyExpr = JSON.stringify(body)
    }
  }

  const lines: string[] = [
    `const axios = require('axios');`,
    '',
  ]

  if (method.toLowerCase() === 'get' && !hasBody) {
    // Simple GET
    lines.push(`const response = await axios.${method.toLowerCase()}(${JSON.stringify(url)}${hasHeaders ? ', {' : ');\n'})`)
    if (hasHeaders) {
      lines.push(`  headers: {`)
      headerEntries.forEach(([k, v]) => lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(v)},`))
      lines.push(`  },`)
      lines.push(`});`)
    }
  } else {
    // Use config object style for clarity
    lines.push(`const response = await axios({`)
    lines.push(`  method: ${JSON.stringify(method.toLowerCase())},`)
    lines.push(`  url: ${JSON.stringify(url)},`)
    if (hasHeaders) {
      lines.push(`  headers: {`)
      headerEntries.forEach(([k, v]) => lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(v)},`))
      lines.push(`  },`)
    }
    if (bodyExpr) {
      lines.push(`  data: ${bodyExpr.split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')},`)
    }
    lines.push(`});`)
  }

  lines.push('')
  lines.push('console.log(response.status, response.data);')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// HAR (HTTP Archive) – single entry
// ---------------------------------------------------------------------------
export function toHar(req: RequestData): string {
  const { method, url, headers, body } = req

  const harHeaders = Object.entries(headers).map(([name, value]) => ({ name, value }))

  // Parse query string
  let queryString: { name: string; value: string }[] = []
  try {
    const urlObj = new URL(url)
    urlObj.searchParams.forEach((value, name) => {
      queryString.push({ name, value })
    })
  } catch {
    // ignore
  }

  const entry: Record<string, unknown> = {
    log: {
      version: '1.2',
      entries: [
        {
          request: {
            method,
            url,
            httpVersion: 'HTTP/1.1',
            headers: harHeaders,
            queryString,
            ...(body
              ? {
                  postData: {
                    mimeType: headers['Content-Type'] || 'application/octet-stream',
                    text: body,
                  },
                }
              : {}),
            headersSize: -1,
            bodySize: body ? new TextEncoder().encode(body).length : 0,
          },
          response: {
            status: 0,
            statusText: '',
            httpVersion: 'HTTP/1.1',
            headers: [],
            content: { size: 0, mimeType: 'text/plain' },
            headersSize: -1,
            bodySize: 0,
          },
          cache: {},
          timings: { send: -1, wait: -1, receive: -1 },
        },
      ],
    },
  }

  return JSON.stringify(entry, null, 2)
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------
export function generateRequestFormat(format: RequestFormat, req: RequestData): string {
  switch (format) {
    case 'http':
      return toHttpRaw(req)
    case 'curl':
      return toCurl(req)
    case 'axios':
      return toAxios(req)
    case 'har':
      return toHar(req)
    default:
      return toHttpRaw(req)
  }
}
