export type RawRequest = {
  method: string;
  pathParams?: {
    [k: string]: any;
  };
  queryParams?: {
    [k: string]: any;
  };
  bodyParams?: {
    [k: string]: any;
  };
  headers?: {
    [k: string]: any;
  };
  body?: any;
  url: {
    href: string;
    pathname: string;
    host: string;
    origin: string;
  };
};

export type RawResponse = {
  status: number;
  headers?: {
    [k: string]: any;
  };
  body?: any;
};

export type SlaOpsEvent = {
  request: RawRequest;
  response: RawResponse;
  info: {
    bodySize: number;
    truncation: string;
    bodyHash: string;
    pathHash: string;
    queryParamsHash: string;
    createdAt: number;
    id: string;
  };
  tags?: Record<string, string>;
  attributes?: Record<string, any>;
};
