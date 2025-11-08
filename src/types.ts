
export type RawRequest = {

  method: string,
  pathParams?: {
    [k: string]: any
  },
  queryParams?: {
    [k: string]: any
  },
  bodyParams?: {
    [k: string]: any
  },
  headers?: {
    [k: string]: any
  },
  body?: any,
  url: {
    href: string,
    pathname: string,
    host: string,
    origin: string,
  }
}


export type RawResponse = {
  status: number,
  headers?: {
    [k: string]: any
  },
  body?: any,
}