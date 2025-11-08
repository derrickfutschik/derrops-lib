export type PrimitiveMap = Record<string, string | number | boolean | null | undefined>;

export type RawRequest = {
  method: string;
  pathParams?: PrimitiveMap;
  queryParams?: PrimitiveMap;
  bodyParams?: PrimitiveMap;
  headers?: PrimitiveMap;
  body?: unknown;
  url: {
    href: string;
    pathname: string;
    host: string;
    origin: string;
  };
};

export type RawResponse = {
  status: number;
  headers?: PrimitiveMap;
  body?: unknown;
};

export type HttpInfo = {
  bodySize: number;
  truncation: 'TEXT' | 'JSON' | 'BINARY' | 'NONE';
  bodyHash: string;
  pathHash: string;
  queryParamsHash: string;
  createdAt: number;
  id: string;
};

export type HttpEvent = {
  request: RawRequest;
  response: RawResponse;
  info: HttpInfo;
  tags?: string[];
  attributes?: PrimitiveMap;
};

export type SlaOpsEvent = HttpEvent;
