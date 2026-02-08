# ServiceApi

All URIs are relative to _http://localhost_

| Method                                                    | HTTP request              | Description          |
| --------------------------------------------------------- | ------------------------- | -------------------- |
| [**serviceControllerCreate**](#servicecontrollercreate)   | **POST** /services        | Create a new service |
| [**serviceControllerFindAll**](#servicecontrollerfindall) | **GET** /services         | Get all services     |
| [**serviceControllerFindOne**](#servicecontrollerfindone) | **GET** /services/{id}    | Get a service by ID  |
| [**serviceControllerRemove**](#servicecontrollerremove)   | **DELETE** /services/{id} | Delete a service     |
| [**serviceControllerUpdate**](#servicecontrollerupdate)   | **PATCH** /services/{id}  | Update a service     |

# **serviceControllerCreate**

> Service serviceControllerCreate(createServiceDto)

### Example

```typescript
import { ServiceApi, Configuration, CreateServiceDto } from './api'

const configuration = new Configuration()
const apiInstance = new ServiceApi(configuration)

let createServiceDto: CreateServiceDto //

const { status, data } = await apiInstance.serviceControllerCreate(createServiceDto)
```

### Parameters

| Name                 | Type                 | Description | Notes |
| -------------------- | -------------------- | ----------- | ----- |
| **createServiceDto** | **CreateServiceDto** |             |       |

### Return type

**Service**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description                  | Response headers |
| ----------- | ---------------------------- | ---------------- |
| **201**     | Service created successfully | -                |
| **400**     | Bad request                  | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **serviceControllerFindAll**

> Array<Service> serviceControllerFindAll()

### Example

```typescript
import { ServiceApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new ServiceApi(configuration)

let select: string //Comma-separated list of fields to select (e.g., id,name,endpoint) (optional) (default to undefined)

const { status, data } = await apiInstance.serviceControllerFindAll(select)
```

### Parameters

| Name       | Type         | Description                                                       | Notes                            |
| ---------- | ------------ | ----------------------------------------------------------------- | -------------------------------- |
| **select** | [**string**] | Comma-separated list of fields to select (e.g., id,name,endpoint) | (optional) defaults to undefined |

### Return type

**Array<Service>**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description      | Response headers |
| ----------- | ---------------- | ---------------- |
| **200**     | List of services | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **serviceControllerFindOne**

> Service serviceControllerFindOne()

### Example

```typescript
import { ServiceApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new ServiceApi(configuration)

let id: string //Service UUID (default to undefined)
let select: string //Comma-separated list of fields to select (optional) (default to undefined)

const { status, data } = await apiInstance.serviceControllerFindOne(id, select)
```

### Parameters

| Name       | Type         | Description                              | Notes                            |
| ---------- | ------------ | ---------------------------------------- | -------------------------------- |
| **id**     | [**string**] | Service UUID                             | defaults to undefined            |
| **select** | [**string**] | Comma-separated list of fields to select | (optional) defaults to undefined |

### Return type

**Service**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description       | Response headers |
| ----------- | ----------------- | ---------------- |
| **200**     | Service found     | -                |
| **404**     | Service not found | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **serviceControllerRemove**

> ServiceControllerRemove200Response serviceControllerRemove()

### Example

```typescript
import { ServiceApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new ServiceApi(configuration)

let id: string //Service UUID (default to undefined)

const { status, data } = await apiInstance.serviceControllerRemove(id)
```

### Parameters

| Name   | Type         | Description  | Notes                 |
| ------ | ------------ | ------------ | --------------------- |
| **id** | [**string**] | Service UUID | defaults to undefined |

### Return type

**ServiceControllerRemove200Response**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                  | Response headers |
| ----------- | ---------------------------- | ---------------- |
| **200**     | Service deleted successfully | -                |
| **404**     | Service not found            | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **serviceControllerUpdate**

> Service serviceControllerUpdate(updateServiceDto)

### Example

```typescript
import { ServiceApi, Configuration, UpdateServiceDto } from './api'

const configuration = new Configuration()
const apiInstance = new ServiceApi(configuration)

let id: string //Service UUID (default to undefined)
let updateServiceDto: UpdateServiceDto //

const { status, data } = await apiInstance.serviceControllerUpdate(id, updateServiceDto)
```

### Parameters

| Name                 | Type                 | Description  | Notes                 |
| -------------------- | -------------------- | ------------ | --------------------- |
| **updateServiceDto** | **UpdateServiceDto** |              |                       |
| **id**               | [**string**]         | Service UUID | defaults to undefined |

### Return type

**Service**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description                  | Response headers |
| ----------- | ---------------------------- | ---------------- |
| **200**     | Service updated successfully | -                |
| **400**     | Bad request                  | -                |
| **404**     | Service not found            | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
