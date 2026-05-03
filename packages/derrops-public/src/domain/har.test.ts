import { describe, expect, it } from '@jest/globals'
import { RawRequest, RawResponse } from '../types'
import { createHarLog } from './har'

describe('HAR Generation', () => {
  it('should create a basic HAR log from request and response', () => {
    const request: RawRequest = {
      method: 'GET',
      url: {
        href: 'https://api.example.com/users?page=1',
        pathname: '/users',
        host: 'api.example.com',
        origin: 'https://api.example.com',
        search: '?page=1',
      },
      headers: {
        'user-agent': 'Derrops/1.0',
        accept: 'application/json',
      },
      httpVersion: 'HTTP/2.0',
    }

    const response: RawResponse = {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-cache',
      },
      body: { users: [] },
      httpVersion: 'HTTP/2.0',
      size: 100,
      mimeType: 'application/json',
    }

    const harLog = createHarLog(request, response)

    expect(harLog.version).toBe('1.2')
    expect(harLog.creator.name).toBe('Derrops')
    expect(harLog.entries).toHaveLength(1)

    const entry = harLog.entries[0]
    expect(entry?.request.method).toBe('GET')
    expect(entry?.request.url).toBe('https://api.example.com/users?page=1')
    expect(entry?.request.httpVersion).toBe('HTTP/2.0')
    expect(entry?.request.headers).toHaveLength(2)
    expect(entry?.request.queryString).toHaveLength(1)
    expect(entry?.request.queryString[0]?.name).toBe('page')
    expect(entry?.request.queryString[0]?.value).toBe('1')

    expect(entry?.response.status).toBe(200)
    expect(entry?.response.statusText).toBe('OK')
    expect(entry?.response.httpVersion).toBe('HTTP/2.0')
    expect(entry?.response.headers).toHaveLength(2)
  })

  it('should parse cookies from request headers', () => {
    const request: RawRequest = {
      method: 'GET',
      url: {
        href: 'https://api.example.com/data',
        pathname: '/data',
        host: 'api.example.com',
        origin: 'https://api.example.com',
      },
      headers: {
        cookie: 'sessionId=abc123; userId=user456',
      },
    }

    const response: RawResponse = {
      status: 200,
      statusText: 'OK',
      size: 0,
      mimeType: 'text/plain',
    }

    const harLog = createHarLog(request, response)
    const entry = harLog.entries[0]

    expect(entry?.request.cookies).toHaveLength(2)
    expect(entry?.request.cookies[0]?.name).toBe('sessionId')
    expect(entry?.request.cookies[0]?.value).toBe('abc123')
    expect(entry?.request.cookies[1]?.name).toBe('userId')
    expect(entry?.request.cookies[1]?.value).toBe('user456')
  })

  it('should parse Set-Cookie headers from response', () => {
    const request: RawRequest = {
      method: 'POST',
      url: {
        href: 'https://api.example.com/login',
        pathname: '/login',
        host: 'api.example.com',
        origin: 'https://api.example.com',
      },
    }

    const response: RawResponse = {
      status: 200,
      statusText: 'OK',
      headers: {
        'set-cookie': [
          'sessionId=xyz789; Path=/; HttpOnly; Secure; SameSite=Strict',
          'theme=dark; Path=/; Expires=Wed, 21 Oct 2025 07:28:00 GMT',
        ],
      },
      size: 0,
      mimeType: 'text/plain',
    }

    const harLog = createHarLog(request, response)
    const entry = harLog.entries[0]

    expect(entry?.response.cookies).toHaveLength(2)
    expect(entry?.response.cookies[0]?.name).toBe('sessionId')
    expect(entry?.response.cookies[0]?.value).toBe('xyz789')
    expect(entry?.response.cookies[0]?.path).toBe('/')
    expect(entry?.response.cookies[0]?.httpOnly).toBe(true)
    expect(entry?.response.cookies[0]?.secure).toBe(true)
    expect(entry?.response.cookies[0]?.sameSite).toBe('Strict')

    expect(entry?.response.cookies[1]?.name).toBe('theme')
    expect(entry?.response.cookies[1]?.value).toBe('dark')
  })

  it('should handle POST data with JSON body', () => {
    const requestBody = { username: 'john', password: 'secret' }

    const request: RawRequest = {
      method: 'POST',
      url: {
        href: 'https://api.example.com/login',
        pathname: '/login',
        host: 'api.example.com',
        origin: 'https://api.example.com',
      },
      headers: {
        'content-type': 'application/json',
      },
      body: requestBody,
    }

    const response: RawResponse = {
      status: 200,
      statusText: 'OK',
      size: 0,
      mimeType: 'application/json',
    }

    const harLog = createHarLog(request, response)
    const entry = harLog.entries[0]

    expect(entry?.request.postData).toBeDefined()
    expect(entry?.request.postData?.mimeType).toBe('application/json')
    expect(entry?.request.postData?.text).toBe(JSON.stringify(requestBody))
  })

  it('should include timing information when available', () => {
    const request: RawRequest = {
      method: 'GET',
      url: {
        href: 'https://api.example.com/data',
        pathname: '/data',
        host: 'api.example.com',
        origin: 'https://api.example.com',
      },
      startedDateTime: '2025-01-15T10:30:00.000Z',
      time: 150,
      timings: {
        blocked: 5,
        dns: 10,
        connect: 20,
        ssl: 15,
        send: 2,
        wait: 80,
        receive: 18,
      },
      serverIPAddress: '192.168.1.1',
      connection: 'tcp-12345',
    }

    const response: RawResponse = {
      status: 200,
      statusText: 'OK',
      size: 100,
      mimeType: 'application/json',
    }

    const harLog = createHarLog(request, response)
    const entry = harLog.entries[0]

    expect(entry?.startedDateTime).toBe('2025-01-15T10:30:00.000Z')
    expect(entry?.time).toBe(150)
    expect(entry?.timings).toBeDefined()
    expect(entry?.timings?.blocked).toBe(5)
    expect(entry?.timings?.dns).toBe(10)
    expect(entry?.timings?.connect).toBe(20)
    expect(entry?.timings?.ssl).toBe(15)
    expect(entry?.timings?.send).toBe(2)
    expect(entry?.timings?.wait).toBe(80)
    expect(entry?.timings?.receive).toBe(18)
    expect(entry?.serverIPAddress).toBe('192.168.1.1')
    expect(entry?.connection).toBe('tcp-12345')
  })

  it('should handle redirect URLs', () => {
    const request: RawRequest = {
      method: 'GET',
      url: {
        href: 'https://api.example.com/old-path',
        pathname: '/old-path',
        host: 'api.example.com',
        origin: 'https://api.example.com',
      },
    }

    const response: RawResponse = {
      status: 301,
      statusText: 'Moved Permanently',
      headers: {
        location: 'https://api.example.com/new-path',
      },
      size: 0,
      mimeType: 'text/html',
    }

    const harLog = createHarLog(request, response)
    const entry = harLog.entries[0]

    expect(entry?.response.redirectURL).toBe('https://api.example.com/new-path')
  })

  it('should calculate header and body sizes', () => {
    const request: RawRequest = {
      method: 'POST',
      url: {
        href: 'https://api.example.com/data',
        pathname: '/data',
        host: 'api.example.com',
        origin: 'https://api.example.com',
      },
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer token123',
      },
      body: { test: 'data' },
    }

    const response: RawResponse = {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'application/json',
      },
      body: { result: 'success' },
      size: 50,
      mimeType: 'application/json',
    }

    const harLog = createHarLog(request, response)
    const entry = harLog.entries[0]

    expect(entry?.request.headersSize).toBeGreaterThan(0)
    expect(entry?.request.bodySize).toBeGreaterThan(0)
    expect(entry?.response.headersSize).toBeGreaterThan(0)
    expect(entry?.response.bodySize).toBe(50)
  })
})
