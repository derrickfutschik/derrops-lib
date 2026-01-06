# ServicesApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**servicesControllerCreate**](#servicescontrollercreate) | **POST** /services | Create a new service|
|[**servicesControllerFindAll**](#servicescontrollerfindall) | **GET** /services | Get all services|
|[**servicesControllerFindOne**](#servicescontrollerfindone) | **GET** /services/{id} | Get a service by ID|
|[**servicesControllerRemove**](#servicescontrollerremove) | **DELETE** /services/{id} | Delete a service|
|[**servicesControllerUpdate**](#servicescontrollerupdate) | **PATCH** /services/{id} | Update a service|

# **servicesControllerCreate**
> Service servicesControllerCreate(createServiceDto)


### Example

```typescript
import {
    ServicesApi,
    Configuration,
    CreateServiceDto
} from './api';

const configuration = new Configuration();
const apiInstance = new ServicesApi(configuration);

let createServiceDto: CreateServiceDto; //

const { status, data } = await apiInstance.servicesControllerCreate(
    createServiceDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **createServiceDto** | **CreateServiceDto**|  | |


### Return type

**Service**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** | Service created successfully |  -  |
|**400** | Bad request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **servicesControllerFindAll**
> Array<Service> servicesControllerFindAll()


### Example

```typescript
import {
    ServicesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ServicesApi(configuration);

let select: string; //Comma-separated list of fields to select (e.g., id,name,endpoint) (optional) (default to undefined)

const { status, data } = await apiInstance.servicesControllerFindAll(
    select
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **select** | [**string**] | Comma-separated list of fields to select (e.g., id,name,endpoint) | (optional) defaults to undefined|


### Return type

**Array<Service>**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | List of services |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **servicesControllerFindOne**
> Service servicesControllerFindOne()


### Example

```typescript
import {
    ServicesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ServicesApi(configuration);

let id: string; //Service UUID (default to undefined)
let select: string; //Comma-separated list of fields to select (optional) (default to undefined)

const { status, data } = await apiInstance.servicesControllerFindOne(
    id,
    select
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Service UUID | defaults to undefined|
| **select** | [**string**] | Comma-separated list of fields to select | (optional) defaults to undefined|


### Return type

**Service**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Service found |  -  |
|**404** | Service not found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **servicesControllerRemove**
> ServicesControllerRemove200Response servicesControllerRemove()


### Example

```typescript
import {
    ServicesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ServicesApi(configuration);

let id: string; //Service UUID (default to undefined)

const { status, data } = await apiInstance.servicesControllerRemove(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Service UUID | defaults to undefined|


### Return type

**ServicesControllerRemove200Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Service deleted successfully |  -  |
|**404** | Service not found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **servicesControllerUpdate**
> Service servicesControllerUpdate(updateServiceDto)


### Example

```typescript
import {
    ServicesApi,
    Configuration,
    UpdateServiceDto
} from './api';

const configuration = new Configuration();
const apiInstance = new ServicesApi(configuration);

let id: string; //Service UUID (default to undefined)
let updateServiceDto: UpdateServiceDto; //

const { status, data } = await apiInstance.servicesControllerUpdate(
    id,
    updateServiceDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **updateServiceDto** | **UpdateServiceDto**|  | |
| **id** | [**string**] | Service UUID | defaults to undefined|


### Return type

**Service**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Service updated successfully |  -  |
|**400** | Bad request |  -  |
|**404** | Service not found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

