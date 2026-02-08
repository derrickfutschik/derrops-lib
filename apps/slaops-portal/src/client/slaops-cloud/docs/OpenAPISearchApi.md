# OpenAPISearchApi

All URIs are relative to _http://localhost_

| Method                                                                            | HTTP request                     | Description                   |
| --------------------------------------------------------------------------------- | -------------------------------- | ----------------------------- |
| [**openApiSearchControllerGetById**](#openapisearchcontrollergetbyid)             | **GET** /openapi-search/{id}     | Get OpenAPI spec by ID        |
| [**openApiSearchControllerGetStats**](#openapisearchcontrollergetstats)           | **GET** /openapi-search/stats    | Get index statistics          |
| [**openApiSearchControllerListProviders**](#openapisearchcontrollerlistproviders) | **GET** /openapi-search/provider | List all API providers        |
| [**openApiSearchControllerSearch**](#openapisearchcontrollersearch)               | **GET** /openapi-search          | Search OpenAPI specifications |

# **openApiSearchControllerGetById**

> openApiSearchControllerGetById()

Retrieve a specific OpenAPI specification by its ID (format: provider/service/version).

### Example

```typescript
import { OpenAPISearchApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new OpenAPISearchApi(configuration)

let id: string //OpenAPI spec ID (URL-encoded, e.g., github.com%2Fapi.github.com%2F1.1.4) (default to undefined)

const { status, data } = await apiInstance.openApiSearchControllerGetById(id)
```

### Parameters

| Name   | Type         | Description                                                              | Notes                 |
| ------ | ------------ | ------------------------------------------------------------------------ | --------------------- |
| **id** | [**string**] | OpenAPI spec ID (URL-encoded, e.g., github.com%2Fapi.github.com%2F1.1.4) | defaults to undefined |

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined

### HTTP response details

| Status code | Description                    | Response headers |
| ----------- | ------------------------------ | ---------------- |
| **200**     | OpenAPI specification document | -                |
| **404**     | OpenAPI spec not found         | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **openApiSearchControllerGetStats**

> IndexStatsResponseDto openApiSearchControllerGetStats()

Returns aggregate statistics about the indexed OpenAPI specifications.

### Example

```typescript
import { OpenAPISearchApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new OpenAPISearchApi(configuration)

const { status, data } = await apiInstance.openApiSearchControllerGetStats()
```

### Parameters

This endpoint does not have any parameters.

### Return type

**IndexStatsResponseDto**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description      | Response headers |
| ----------- | ---------------- | ---------------- |
| **200**     | Index statistics | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **openApiSearchControllerListProviders**

> Array<ProviderListResponseDto> openApiSearchControllerListProviders()

Returns a list of all unique providers/domains with the count of API specs for each.

### Example

```typescript
import { OpenAPISearchApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new OpenAPISearchApi(configuration)

const { status, data } = await apiInstance.openApiSearchControllerListProviders()
```

### Parameters

This endpoint does not have any parameters.

### Return type

**Array<ProviderListResponseDto>**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description       | Response headers |
| ----------- | ----------------- | ---------------- |
| **200**     | List of providers | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **openApiSearchControllerSearch**

> OpenApiSearchResponseDto openApiSearchControllerSearch()

Search indexed OpenAPI specs by title, description, operations, tags, and more. Supports full-text search and filtering.

### Example

```typescript
import { OpenAPISearchApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new OpenAPISearchApi(configuration)

let query: string //Free-text search across title, description, and operation text (optional) (default to undefined)
let provider: string //Filter by provider/domain (optional) (default to undefined)
let tags: Array<string> //Filter by tags (comma-separated) (optional) (default to undefined)
let method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' //Filter by HTTP method (optional) (default to undefined)
let pathPrefix: string //Filter by path prefix (from operationStats.pathPrefixes) (optional) (default to undefined)
let operationId: string //Filter by exact operationId (optional) (default to undefined)
let serverPattern: string //Filter by server URL pattern (optional) (default to undefined)
let from: number //Pagination offset (optional) (default to 0)
let size: number //Number of results to return (optional) (default to 20)
let sortField: 'title' | 'provider' | 'indexedAt' | 'operationStats.total' | '_score' //Sort field (optional) (default to '_score')
let sortOrder: 'asc' | 'desc' //Sort order (optional) (default to 'desc')

const { status, data } = await apiInstance.openApiSearchControllerSearch(
  query,
  provider,
  tags,
  method,
  pathPrefix,
  operationId,
  serverPattern,
  from,
  size,
  sortField,
  sortOrder,
)
```

### Parameters

| Name              | Type                    | Description                                                       | Notes                            |
| ----------------- | ----------------------- | ----------------------------------------------------------------- | -------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------- |
| **query**         | [**string**]            | Free-text search across title, description, and operation text    | (optional) defaults to undefined |
| **provider**      | [**string**]            | Filter by provider/domain                                         | (optional) defaults to undefined |
| **tags**          | **Array&lt;string&gt;** | Filter by tags (comma-separated)                                  | (optional) defaults to undefined |
| **method**        | [\*\*&#39;GET&#39;      | &#39;POST&#39;                                                    | &#39;PUT&#39;                    | &#39;DELETE&#39;               | &#39;PATCH&#39;                                                                                                                                                      | &#39;HEAD&#39; | &#39;OPTIONS&#39;**]**Array<&#39;GET&#39; &#124; &#39;POST&#39; &#124; &#39;PUT&#39; &#124; &#39;DELETE&#39; &#124; &#39;PATCH&#39; &#124; &#39;HEAD&#39; &#124; &#39;OPTIONS&#39;>\*\* | Filter by HTTP method | (optional) defaults to undefined |
| **pathPrefix**    | [**string**]            | Filter by path prefix (from operationStats.pathPrefixes)          | (optional) defaults to undefined |
| **operationId**   | [**string**]            | Filter by exact operationId                                       | (optional) defaults to undefined |
| **serverPattern** | [**string**]            | Filter by server URL pattern                                      | (optional) defaults to undefined |
| **from**          | [**number**]            | Pagination offset                                                 | (optional) defaults to 0         |
| **size**          | [**number**]            | Number of results to return                                       | (optional) defaults to 20        |
| **sortField**     | [\*\*&#39;title&#39;    | &#39;provider&#39;                                                | &#39;indexedAt&#39;              | &#39;operationStats.total&#39; | &#39;\_score&#39;**]**Array<&#39;title&#39; &#124; &#39;provider&#39; &#124; &#39;indexedAt&#39; &#124; &#39;operationStats.total&#39; &#124; &#39;\_score&#39;>\*\* | Sort field     | (optional) defaults to '\_score'                                                                                                                                                        |
| **sortOrder**     | [\*\*&#39;asc&#39;      | &#39;desc&#39;**]**Array<&#39;asc&#39; &#124; &#39;desc&#39;>\*\* | Sort order                       | (optional) defaults to 'desc'  |

### Return type

**OpenApiSearchResponseDto**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description    | Response headers |
| ----------- | -------------- | ---------------- |
| **200**     | Search results | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
