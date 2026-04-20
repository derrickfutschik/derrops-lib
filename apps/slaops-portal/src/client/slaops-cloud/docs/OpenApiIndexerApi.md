# OpenAPIIndexerApi

All URIs are relative to _http://localhost_

| Method                                                                                  | HTTP request                            | Description                                                        |
| --------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------ |
| [**openApiIndexerControllerGetModels**](#openapiindexercontrollergetmodels)             | **GET** /openapi/api/{apiId}/models     | Paginated models for an API version                                |
| [**openApiIndexerControllerGetOperations**](#openapiindexercontrollergetoperations)     | **GET** /openapi/api/{apiId}/operations | Paginated operations for an API version                            |
| [**openApiIndexerControllerGetParameters**](#openapiindexercontrollergetparameters)     | **GET** /openapi/api/{apiId}/parameters | Paginated parameters for an API version                            |
| [**openApiIndexerControllerGetServers**](#openapiindexercontrollergetservers)           | **GET** /openapi/api/{apiId}/servers    | Paginated servers for an API version                               |
| [**openApiIndexerControllerGetUploadUrl**](#openapiindexercontrollergetuploadurl)       | **POST** /openapi/upload-url            | Get a pre-signed PUT URL for uploading a spec to the OASpec bucket |
| [**openApiIndexerControllerGetVersions**](#openapiindexercontrollergetversions)         | **GET** /openapi/api/{apiId}/versions   | Paginated spec version history for an API                          |
| [**openApiIndexerControllerIndexFromS3**](#openapiindexercontrollerindexfroms3)         | **POST** /openapi/index                 | Index a spec from S3 — runs the 6-step OASpec pipeline             |
| [**openApiIndexerControllerSearchCatalogue**](#openapiindexercontrollersearchcatalogue) | **GET** /openapi/catalogue              | Search the platform-managed API catalogue                          |

# **openApiIndexerControllerGetModels**

> openApiIndexerControllerGetModels()

### Example

```typescript
import { OpenAPIIndexerApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new OpenAPIIndexerApi(configuration)

let apiId: string //API UUID (default to undefined)
let from: number // (optional) (default to undefined)
let size: number // (optional) (default to undefined)
let order: 'asc' | 'desc' // (optional) (default to undefined)
let q: string // (optional) (default to undefined)
let usedIn: string //request | response (optional) (default to undefined)
let operationId: string // (optional) (default to undefined)
let sort: string // (optional) (default to undefined)
let version: any // (optional) (default to undefined)

const { status, data } = await apiInstance.openApiIndexerControllerGetModels(
  apiId,
  from,
  size,
  order,
  q,
  usedIn,
  operationId,
  sort,
  version,
)
```

### Parameters

| Name            | Type               | Description                                                       | Notes                            |
| --------------- | ------------------ | ----------------------------------------------------------------- | -------------------------------- | -------------------------------- |
| **apiId**       | [**string**]       | API UUID                                                          | defaults to undefined            |
| **from**        | [**number**]       |                                                                   | (optional) defaults to undefined |
| **size**        | [**number**]       |                                                                   | (optional) defaults to undefined |
| **order**       | [\*\*&#39;asc&#39; | &#39;desc&#39;**]**Array<&#39;asc&#39; &#124; &#39;desc&#39;>\*\* |                                  | (optional) defaults to undefined |
| **q**           | [**string**]       |                                                                   | (optional) defaults to undefined |
| **usedIn**      | [**string**]       | request                                                           | response                         | (optional) defaults to undefined |
| **operationId** | [**string**]       |                                                                   | (optional) defaults to undefined |
| **sort**        | [**string**]       |                                                                   | (optional) defaults to undefined |
| **version**     | **any**            |                                                                   | (optional) defaults to undefined |

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **openApiIndexerControllerGetOperations**

> openApiIndexerControllerGetOperations()

### Example

```typescript
import { OpenAPIIndexerApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new OpenAPIIndexerApi(configuration)

let apiId: string //API UUID (default to undefined)
let from: number // (optional) (default to undefined)
let size: number // (optional) (default to undefined)
let order: 'asc' | 'desc' // (optional) (default to undefined)
let q: string //Free-text search (optional) (default to undefined)
let method: string //Comma-separated HTTP method filter (optional) (default to undefined)
let tag: string //Tag filter (optional) (default to undefined)
let sort: string // (optional) (default to undefined)
let version: any //Specific version or \"latest\" (default) (optional) (default to undefined)

const { status, data } = await apiInstance.openApiIndexerControllerGetOperations(
  apiId,
  from,
  size,
  order,
  q,
  method,
  tag,
  sort,
  version,
)
```

### Parameters

| Name        | Type               | Description                                                       | Notes                            |
| ----------- | ------------------ | ----------------------------------------------------------------- | -------------------------------- | -------------------------------- |
| **apiId**   | [**string**]       | API UUID                                                          | defaults to undefined            |
| **from**    | [**number**]       |                                                                   | (optional) defaults to undefined |
| **size**    | [**number**]       |                                                                   | (optional) defaults to undefined |
| **order**   | [\*\*&#39;asc&#39; | &#39;desc&#39;**]**Array<&#39;asc&#39; &#124; &#39;desc&#39;>\*\* |                                  | (optional) defaults to undefined |
| **q**       | [**string**]       | Free-text search                                                  | (optional) defaults to undefined |
| **method**  | [**string**]       | Comma-separated HTTP method filter                                | (optional) defaults to undefined |
| **tag**     | [**string**]       | Tag filter                                                        | (optional) defaults to undefined |
| **sort**    | [**string**]       |                                                                   | (optional) defaults to undefined |
| **version** | **any**            | Specific version or \&quot;latest\&quot; (default)                | (optional) defaults to undefined |

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **openApiIndexerControllerGetParameters**

> openApiIndexerControllerGetParameters()

### Example

```typescript
import { OpenAPIIndexerApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new OpenAPIIndexerApi(configuration)

let apiId: string //API UUID (default to undefined)
let from: number // (optional) (default to undefined)
let size: number // (optional) (default to undefined)
let order: 'asc' | 'desc' // (optional) (default to undefined)
let q: string // (optional) (default to undefined)
let location: string //path | query | header | cookie (optional) (default to undefined)
let operationId: string // (optional) (default to undefined)
let sort: string // (optional) (default to undefined)
let version: any // (optional) (default to undefined)

const { status, data } = await apiInstance.openApiIndexerControllerGetParameters(
  apiId,
  from,
  size,
  order,
  q,
  location,
  operationId,
  sort,
  version,
)
```

### Parameters

| Name            | Type               | Description                                                       | Notes                            |
| --------------- | ------------------ | ----------------------------------------------------------------- | -------------------------------- | -------------------------------- | ------ | -------------------------------- |
| **apiId**       | [**string**]       | API UUID                                                          | defaults to undefined            |
| **from**        | [**number**]       |                                                                   | (optional) defaults to undefined |
| **size**        | [**number**]       |                                                                   | (optional) defaults to undefined |
| **order**       | [\*\*&#39;asc&#39; | &#39;desc&#39;**]**Array<&#39;asc&#39; &#124; &#39;desc&#39;>\*\* |                                  | (optional) defaults to undefined |
| **q**           | [**string**]       |                                                                   | (optional) defaults to undefined |
| **location**    | [**string**]       | path                                                              | query                            | header                           | cookie | (optional) defaults to undefined |
| **operationId** | [**string**]       |                                                                   | (optional) defaults to undefined |
| **sort**        | [**string**]       |                                                                   | (optional) defaults to undefined |
| **version**     | **any**            |                                                                   | (optional) defaults to undefined |

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **openApiIndexerControllerGetServers**

> openApiIndexerControllerGetServers()

### Example

```typescript
import { OpenAPIIndexerApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new OpenAPIIndexerApi(configuration)

let apiId: string //API UUID (default to undefined)
let from: number // (optional) (default to undefined)
let size: number // (optional) (default to undefined)
let order: 'asc' | 'desc' // (optional) (default to undefined)
let sort: string // (optional) (default to undefined)
let version: any // (optional) (default to undefined)

const { status, data } = await apiInstance.openApiIndexerControllerGetServers(
  apiId,
  from,
  size,
  order,
  sort,
  version,
)
```

### Parameters

| Name        | Type               | Description                                                       | Notes                            |
| ----------- | ------------------ | ----------------------------------------------------------------- | -------------------------------- | -------------------------------- |
| **apiId**   | [**string**]       | API UUID                                                          | defaults to undefined            |
| **from**    | [**number**]       |                                                                   | (optional) defaults to undefined |
| **size**    | [**number**]       |                                                                   | (optional) defaults to undefined |
| **order**   | [\*\*&#39;asc&#39; | &#39;desc&#39;**]**Array<&#39;asc&#39; &#124; &#39;desc&#39;>\*\* |                                  | (optional) defaults to undefined |
| **sort**    | [**string**]       |                                                                   | (optional) defaults to undefined |
| **version** | **any**            |                                                                   | (optional) defaults to undefined |

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **openApiIndexerControllerGetUploadUrl**

> openApiIndexerControllerGetUploadUrl(body)

### Example

```typescript
import { OpenAPIIndexerApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new OpenAPIIndexerApi(configuration)

let body: object //

const { status, data } = await apiInstance.openApiIndexerControllerGetUploadUrl(body)
```

### Parameters

| Name     | Type       | Description | Notes |
| -------- | ---------- | ----------- | ----- |
| **body** | **object** |             |       |

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **openApiIndexerControllerGetVersions**

> openApiIndexerControllerGetVersions()

### Example

```typescript
import { OpenAPIIndexerApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new OpenAPIIndexerApi(configuration)

let apiId: string //API UUID (default to undefined)
let from: number // (optional) (default to undefined)
let size: number // (optional) (default to undefined)
let order: 'asc' | 'desc' // (optional) (default to undefined)
let sort: string // (optional) (default to undefined)

const { status, data } = await apiInstance.openApiIndexerControllerGetVersions(
  apiId,
  from,
  size,
  order,
  sort,
)
```

### Parameters

| Name      | Type               | Description                                                       | Notes                            |
| --------- | ------------------ | ----------------------------------------------------------------- | -------------------------------- | -------------------------------- |
| **apiId** | [**string**]       | API UUID                                                          | defaults to undefined            |
| **from**  | [**number**]       |                                                                   | (optional) defaults to undefined |
| **size**  | [**number**]       |                                                                   | (optional) defaults to undefined |
| **order** | [\*\*&#39;asc&#39; | &#39;desc&#39;**]**Array<&#39;asc&#39; &#124; &#39;desc&#39;>\*\* |                                  | (optional) defaults to undefined |
| **sort**  | [**string**]       |                                                                   | (optional) defaults to undefined |

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **openApiIndexerControllerIndexFromS3**

> openApiIndexerControllerIndexFromS3(body)

### Example

```typescript
import { OpenAPIIndexerApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new OpenAPIIndexerApi(configuration)

let body: object //

const { status, data } = await apiInstance.openApiIndexerControllerIndexFromS3(body)
```

### Parameters

| Name     | Type       | Description | Notes |
| -------- | ---------- | ----------- | ----- |
| **body** | **object** |             |       |

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **openApiIndexerControllerSearchCatalogue**

> openApiIndexerControllerSearchCatalogue()

### Example

```typescript
import { OpenAPIIndexerApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new OpenAPIIndexerApi(configuration)

let offset: number //Offset (default 0) (optional) (default to undefined)
let limit: number //Max results (default 10) (optional) (default to undefined)
let q: any //Search query (optional) (default to undefined)

const { status, data } = await apiInstance.openApiIndexerControllerSearchCatalogue(offset, limit, q)
```

### Parameters

| Name       | Type         | Description              | Notes                            |
| ---------- | ------------ | ------------------------ | -------------------------------- |
| **offset** | [**number**] | Offset (default 0)       | (optional) defaults to undefined |
| **limit**  | [**number**] | Max results (default 10) | (optional) defaults to undefined |
| **q**      | **any**      | Search query             | (optional) defaults to undefined |

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
