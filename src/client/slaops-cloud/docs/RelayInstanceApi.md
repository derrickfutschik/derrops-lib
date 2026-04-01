# RelayInstanceApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**relayInstanceControllerCreate**](#relayinstancecontrollercreate) | **POST** /cloud-relay/relay-instance | Register a new relay instance|
|[**relayInstanceControllerFindAll**](#relayinstancecontrollerfindall) | **GET** /cloud-relay/relay-instance | List all relay instances for the tenant|
|[**relayInstanceControllerFindOne**](#relayinstancecontrollerfindone) | **GET** /cloud-relay/relay-instance/{id} | Get a relay instance by ID|
|[**relayInstanceControllerHealthCheck**](#relayinstancecontrollerhealthcheck) | **POST** /cloud-relay/relay-instance/{id}/health-check | Trigger a health check on the relay instance (mints a platform JWT and calls relay /health)|
|[**relayInstanceControllerRemove**](#relayinstancecontrollerremove) | **DELETE** /cloud-relay/relay-instance/{id} | Delete a relay instance|
|[**relayInstanceControllerUpdate**](#relayinstancecontrollerupdate) | **PATCH** /cloud-relay/relay-instance/{id} | Update a relay instance|

# **relayInstanceControllerCreate**
> RelayInstance relayInstanceControllerCreate(createRelayInstanceDto)


### Example

```typescript
import {
    RelayInstanceApi,
    Configuration,
    CreateRelayInstanceDto
} from './api';

const configuration = new Configuration();
const apiInstance = new RelayInstanceApi(configuration);

let xTenantId: string; //Tenant UUID (default to undefined)
let createRelayInstanceDto: CreateRelayInstanceDto; //

const { status, data } = await apiInstance.relayInstanceControllerCreate(
    xTenantId,
    createRelayInstanceDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **createRelayInstanceDto** | **CreateRelayInstanceDto**|  | |
| **xTenantId** | [**string**] | Tenant UUID | defaults to undefined|


### Return type

**RelayInstance**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **relayInstanceControllerFindAll**
> Array<RelayInstance> relayInstanceControllerFindAll()


### Example

```typescript
import {
    RelayInstanceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RelayInstanceApi(configuration);

let xTenantId: string; //Tenant UUID (default to undefined)

const { status, data } = await apiInstance.relayInstanceControllerFindAll(
    xTenantId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **xTenantId** | [**string**] | Tenant UUID | defaults to undefined|


### Return type

**Array<RelayInstance>**

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

# **relayInstanceControllerFindOne**
> RelayInstance relayInstanceControllerFindOne()


### Example

```typescript
import {
    RelayInstanceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RelayInstanceApi(configuration);

let xTenantId: string; //Tenant UUID (default to undefined)
let id: string; //RelayInstance UUID (default to undefined)

const { status, data } = await apiInstance.relayInstanceControllerFindOne(
    xTenantId,
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **xTenantId** | [**string**] | Tenant UUID | defaults to undefined|
| **id** | [**string**] | RelayInstance UUID | defaults to undefined|


### Return type

**RelayInstance**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |
|**404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **relayInstanceControllerHealthCheck**
> RelayInstance relayInstanceControllerHealthCheck()


### Example

```typescript
import {
    RelayInstanceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RelayInstanceApi(configuration);

let xTenantId: string; //Tenant UUID (default to undefined)
let id: string; //RelayInstance UUID (default to undefined)

const { status, data } = await apiInstance.relayInstanceControllerHealthCheck(
    xTenantId,
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **xTenantId** | [**string**] | Tenant UUID | defaults to undefined|
| **id** | [**string**] | RelayInstance UUID | defaults to undefined|


### Return type

**RelayInstance**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |
|**404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **relayInstanceControllerRemove**
> relayInstanceControllerRemove()


### Example

```typescript
import {
    RelayInstanceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RelayInstanceApi(configuration);

let xTenantId: string; //Tenant UUID (default to undefined)
let id: string; //RelayInstance UUID (default to undefined)

const { status, data } = await apiInstance.relayInstanceControllerRemove(
    xTenantId,
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **xTenantId** | [**string**] | Tenant UUID | defaults to undefined|
| **id** | [**string**] | RelayInstance UUID | defaults to undefined|


### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**204** |  |  -  |
|**404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **relayInstanceControllerUpdate**
> RelayInstance relayInstanceControllerUpdate(updateRelayInstanceDto)


### Example

```typescript
import {
    RelayInstanceApi,
    Configuration,
    UpdateRelayInstanceDto
} from './api';

const configuration = new Configuration();
const apiInstance = new RelayInstanceApi(configuration);

let xTenantId: string; //Tenant UUID (default to undefined)
let id: string; //RelayInstance UUID (default to undefined)
let updateRelayInstanceDto: UpdateRelayInstanceDto; //

const { status, data } = await apiInstance.relayInstanceControllerUpdate(
    xTenantId,
    id,
    updateRelayInstanceDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **updateRelayInstanceDto** | **UpdateRelayInstanceDto**|  | |
| **xTenantId** | [**string**] | Tenant UUID | defaults to undefined|
| **id** | [**string**] | RelayInstance UUID | defaults to undefined|


### Return type

**RelayInstance**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |
|**404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

