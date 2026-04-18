# OpenAPIIndexerApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**openApiIndexerControllerGetUploadUrl**](#openapiindexercontrollergetuploadurl) | **POST** /openapi/upload-url | Get a pre-signed PUT URL for uploading a spec to the OASpec bucket|
|[**openApiIndexerControllerIndexFromS3**](#openapiindexercontrollerindexfroms3) | **POST** /openapi/index | Index a spec from S3 — runs the 6-step OASpec pipeline|
|[**openApiIndexerControllerSearchCatalogue**](#openapiindexercontrollersearchcatalogue) | **GET** /openapi/catalogue | Search the platform-managed API catalogue|

# **openApiIndexerControllerGetUploadUrl**
> openApiIndexerControllerGetUploadUrl(body)


### Example

```typescript
import {
    OpenAPIIndexerApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OpenAPIIndexerApi(configuration);

let body: object; //

const { status, data } = await apiInstance.openApiIndexerControllerGetUploadUrl(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**|  | |


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **openApiIndexerControllerIndexFromS3**
> openApiIndexerControllerIndexFromS3(body)


### Example

```typescript
import {
    OpenAPIIndexerApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OpenAPIIndexerApi(configuration);

let body: object; //

const { status, data } = await apiInstance.openApiIndexerControllerIndexFromS3(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**|  | |


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **openApiIndexerControllerSearchCatalogue**
> openApiIndexerControllerSearchCatalogue()


### Example

```typescript
import {
    OpenAPIIndexerApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OpenAPIIndexerApi(configuration);

let offset: number; //Offset (default 0) (optional) (default to undefined)
let limit: number; //Max results (default 10) (optional) (default to undefined)
let q: any; //Search query (optional) (default to undefined)

const { status, data } = await apiInstance.openApiIndexerControllerSearchCatalogue(
    offset,
    limit,
    q
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **offset** | [**number**] | Offset (default 0) | (optional) defaults to undefined|
| **limit** | [**number**] | Max results (default 10) | (optional) defaults to undefined|
| **q** | **any** | Search query | (optional) defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

