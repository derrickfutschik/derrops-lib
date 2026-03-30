# AegisInstanceApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**aegisInstanceControllerCreate**](#aegisinstancecontrollercreate) | **POST** /cloud-relay/aegis-instance | Register a new Aegis instance|
|[**aegisInstanceControllerFindAll**](#aegisinstancecontrollerfindall) | **GET** /cloud-relay/aegis-instance | List all Aegis instances for the tenant|
|[**aegisInstanceControllerFindOne**](#aegisinstancecontrollerfindone) | **GET** /cloud-relay/aegis-instance/{id} | Get an Aegis instance by ID|
|[**aegisInstanceControllerHealthCheck**](#aegisinstancecontrollerhealthcheck) | **POST** /cloud-relay/aegis-instance/{id}/health-check | Trigger a health check on the Aegis instance (validates JWKS endpoint)|
|[**aegisInstanceControllerRemove**](#aegisinstancecontrollerremove) | **DELETE** /cloud-relay/aegis-instance/{id} | Delete an Aegis instance|
|[**aegisInstanceControllerUpdate**](#aegisinstancecontrollerupdate) | **PATCH** /cloud-relay/aegis-instance/{id} | Update an Aegis instance|
|[**aegisRegisterControllerRegister**](#aegisregistercontrollerregister) | **POST** /cloud-relay/aegis/register | Complete Aegis instance registration (called by Aegis)|

# **aegisInstanceControllerCreate**
> AegisCreateResponseDto aegisInstanceControllerCreate(createAegisInstanceDto)

Returns a one-time `registrationToken`. Configure Aegis with this token so it can complete the registration handshake via POST /cloud-relay/aegis/register.

### Example

```typescript
import {
    AegisInstanceApi,
    Configuration,
    CreateAegisInstanceDto
} from './api';

const configuration = new Configuration();
const apiInstance = new AegisInstanceApi(configuration);

let xTenantId: string; //Tenant UUID (default to undefined)
let createAegisInstanceDto: CreateAegisInstanceDto; //

const { status, data } = await apiInstance.aegisInstanceControllerCreate(
    xTenantId,
    createAegisInstanceDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **createAegisInstanceDto** | **CreateAegisInstanceDto**|  | |
| **xTenantId** | [**string**] | Tenant UUID | defaults to undefined|


### Return type

**AegisCreateResponseDto**

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

# **aegisInstanceControllerFindAll**
> Array<AegisInstance> aegisInstanceControllerFindAll()


### Example

```typescript
import {
    AegisInstanceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AegisInstanceApi(configuration);

let xTenantId: string; //Tenant UUID (default to undefined)

const { status, data } = await apiInstance.aegisInstanceControllerFindAll(
    xTenantId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **xTenantId** | [**string**] | Tenant UUID | defaults to undefined|


### Return type

**Array<AegisInstance>**

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

# **aegisInstanceControllerFindOne**
> AegisInstance aegisInstanceControllerFindOne()


### Example

```typescript
import {
    AegisInstanceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AegisInstanceApi(configuration);

let xTenantId: string; //Tenant UUID (default to undefined)
let id: string; //AegisInstance UUID (default to undefined)

const { status, data } = await apiInstance.aegisInstanceControllerFindOne(
    xTenantId,
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **xTenantId** | [**string**] | Tenant UUID | defaults to undefined|
| **id** | [**string**] | AegisInstance UUID | defaults to undefined|


### Return type

**AegisInstance**

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

# **aegisInstanceControllerHealthCheck**
> AegisInstance aegisInstanceControllerHealthCheck()


### Example

```typescript
import {
    AegisInstanceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AegisInstanceApi(configuration);

let xTenantId: string; //Tenant UUID (default to undefined)
let id: string; //AegisInstance UUID (default to undefined)

const { status, data } = await apiInstance.aegisInstanceControllerHealthCheck(
    xTenantId,
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **xTenantId** | [**string**] | Tenant UUID | defaults to undefined|
| **id** | [**string**] | AegisInstance UUID | defaults to undefined|


### Return type

**AegisInstance**

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

# **aegisInstanceControllerRemove**
> aegisInstanceControllerRemove()


### Example

```typescript
import {
    AegisInstanceApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AegisInstanceApi(configuration);

let xTenantId: string; //Tenant UUID (default to undefined)
let id: string; //AegisInstance UUID (default to undefined)

const { status, data } = await apiInstance.aegisInstanceControllerRemove(
    xTenantId,
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **xTenantId** | [**string**] | Tenant UUID | defaults to undefined|
| **id** | [**string**] | AegisInstance UUID | defaults to undefined|


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

# **aegisInstanceControllerUpdate**
> AegisInstance aegisInstanceControllerUpdate(updateAegisInstanceDto)


### Example

```typescript
import {
    AegisInstanceApi,
    Configuration,
    UpdateAegisInstanceDto
} from './api';

const configuration = new Configuration();
const apiInstance = new AegisInstanceApi(configuration);

let xTenantId: string; //Tenant UUID (default to undefined)
let id: string; //AegisInstance UUID (default to undefined)
let updateAegisInstanceDto: UpdateAegisInstanceDto; //

const { status, data } = await apiInstance.aegisInstanceControllerUpdate(
    xTenantId,
    id,
    updateAegisInstanceDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **updateAegisInstanceDto** | **UpdateAegisInstanceDto**|  | |
| **xTenantId** | [**string**] | Tenant UUID | defaults to undefined|
| **id** | [**string**] | AegisInstance UUID | defaults to undefined|


### Return type

**AegisInstance**

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

# **aegisRegisterControllerRegister**
> AegisInstance aegisRegisterControllerRegister(aegisRegisterDto)

Aegis posts its one-time registration token and JWKS URL. On success the instance transitions from `pending` to `active` and the token is invalidated.

### Example

```typescript
import {
    AegisInstanceApi,
    Configuration,
    AegisRegisterDto
} from './api';

const configuration = new Configuration();
const apiInstance = new AegisInstanceApi(configuration);

let aegisRegisterDto: AegisRegisterDto; //

const { status, data } = await apiInstance.aegisRegisterControllerRegister(
    aegisRegisterDto
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **aegisRegisterDto** | **AegisRegisterDto**|  | |


### Return type

**AegisInstance**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |
|**400** | Invalid or already-used registration token |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

