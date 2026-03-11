# OpenApiIndexerApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**openApiIndexerControllerGetUploadUrl**](#openapiindexercontrollergetuploadurl) | **POST** /openapi/upload-url | |
|[**openApiIndexerControllerIndexFromBody**](#openapiindexercontrollerindexfrombody) | **POST** /openapi | |
|[**openApiIndexerControllerIndexFromS3**](#openapiindexercontrollerindexfroms3) | **POST** /openapi/index | |

# **openApiIndexerControllerGetUploadUrl**
> object openApiIndexerControllerGetUploadUrl(body)


### Example

```typescript
import {
    OpenApiIndexerApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OpenApiIndexerApi(configuration);

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

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **openApiIndexerControllerIndexFromBody**
> object openApiIndexerControllerIndexFromBody()


### Example

```typescript
import {
    OpenApiIndexerApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OpenApiIndexerApi(configuration);

const { status, data } = await apiInstance.openApiIndexerControllerIndexFromBody();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **openApiIndexerControllerIndexFromS3**
> object openApiIndexerControllerIndexFromS3(body)


### Example

```typescript
import {
    OpenApiIndexerApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OpenApiIndexerApi(configuration);

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

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

