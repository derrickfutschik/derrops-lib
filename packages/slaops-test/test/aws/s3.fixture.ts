import { HarEntry } from '@slaops/public'

const har: HarEntry = {
  startedDateTime: '2025-11-30T10:21:15.011Z',
  time: 11,
  request: {
    method: 'GET',
    url: 'http://192.168.7.224:4566/bucket-bar/',
    httpVersion: 'HTTP/1.1',
    cookies: [],
    headers: [
      {
        name: 'Accept',
        value: 'application/json, text/plain, */*',
      },
      {
        name: 'Content-Type',
        value: 'undefined',
      },
      {
        name: 'x-amz-user-agent',
        value: 'aws-sdk-js/3.940.0',
      },
      {
        name: 'user-agent',
        value:
          'aws-sdk-js/3.940.0 ua/2.1 os/darwin#24.6.0 lang/js md/nodejs#22.21.1 api/s3#3.940.0 m/N,E,n',
      },
      {
        name: 'host',
        value: '192.168.7.224:4566',
      },
      {
        name: 'amz-sdk-invocation-id',
        value: 'e794dc24-957d-486e-82aa-981acf468a5e',
      },
      {
        name: 'amz-sdk-request',
        value: 'attempt=1; max=3',
      },
      {
        name: 'x-amz-date',
        value: '20251130T102115Z',
      },
      {
        name: 'x-amz-content-sha256',
        value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
      {
        name: 'authorization',
        value:
          'AWS4-HMAC-SHA256 Credential=ABCDEFGHIJKLMNOPQRSTUVWXYZ/20251130/us-east-1/s3/aws4_request, SignedHeaders=amz-sdk-invocation-id;amz-sdk-request;host;x-amz-content-sha256;x-amz-date;x-amz-user-agent, Signature=abcdefghijklmnopqrstuvwxyz',
      },
      {
        name: 'Accept-Encoding',
        value: 'gzip, compress, deflate, br',
      },
    ],
    queryString: [],
    headersSize: -1,
    bodySize: 0,
  },
  response: {
    status: 200,
    statusText: 'OK',
    httpVersion: 'HTTP/1.1',
    cookies: [],
    headers: [
      {
        name: 'server',
        value: 'TwistedWeb/24.3.0',
      },
      {
        name: 'date',
        value: 'Sun, 30 Nov 2025 10:21:15 GMT',
      },
      {
        name: 'content-type',
        value: 'application/xml',
      },
      {
        name: 'content-length',
        value: '223',
      },
      {
        name: 'x-amz-request-id',
        value: '2e45d3e2-30d2-482e-a6f7-979abea4ebe9',
      },
      {
        name: 'x-amz-id-2',
        value: 's9lzHYrFp76ZVxRcpX9+5cjAnEH2ROuNkd2BHfIa6UkFVdtjf5mKR3/eTPFvsiP/XV/VLi31234=',
      },
      {
        name: 'x-localstack',
        value: 'true',
      },
    ],
    content: {
      size: 223,
      mimeType: 'application/xml',
    },
    redirectURL: '',
    headersSize: -1,
    bodySize: 223,
  },
  cache: {},
  timings: {
    send: 0,
    wait: 11,
    receive: 0,
  },
}
