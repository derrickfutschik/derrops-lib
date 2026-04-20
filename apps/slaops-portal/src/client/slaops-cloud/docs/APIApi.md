# APIApi

All URIs are relative to _http://localhost_

| Method                                            | HTTP request          | Description                                                    |
| ------------------------------------------------- | --------------------- | -------------------------------------------------------------- |
| [**apiControllerAdopt**](#apicontrolleradopt)     | **POST** /apis/adopt  | Adopt a platform-managed API from the global catalogue         |
| [**apiControllerCreate**](#apicontrollercreate)   | **POST** /apis        | Create a new API                                               |
| [**apiControllerFindAll**](#apicontrollerfindall) | **GET** /apis         | List the tenant\&#39;s APIs                                    |
| [**apiControllerFindOne**](#apicontrollerfindone) | **GET** /apis/{id}    | Get a single API                                               |
| [**apiControllerGetInfo**](#apicontrollergetinfo) | **GET** /apis/info    | Fetch the info block from a remote OpenAPI document            |
| [**apiControllerRemove**](#apicontrollerremove)   | **DELETE** /apis/{id} | Delete an API                                                  |
| [**apiControllerUpdate**](#apicontrollerupdate)   | **PATCH** /apis/{id}  | Update an API (name, description, externalUrl, fetch strategy) |

# **apiControllerAdopt**

> ApiEntity apiControllerAdopt(adoptApiDto)

Creates an api row with management_mode=platform pointing to the specified global catalogue document. No private index is provisioned — the tenant reads from the platform-managed global tier.

### Example

```typescript
import { APIApi, Configuration, AdoptApiDto } from './api'

const configuration = new Configuration()
const apiInstance = new APIApi(configuration)

let adoptApiDto: AdoptApiDto //

const { status, data } = await apiInstance.apiControllerAdopt(adoptApiDto)
```

### Parameters

| Name            | Type            | Description | Notes |
| --------------- | --------------- | ----------- | ----- |
| **adoptApiDto** | **AdoptApiDto** |             |       |

### Return type

**ApiEntity**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **201**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiControllerCreate**

> ApiEntity apiControllerCreate(createApiDto)

### Example

```typescript
import { APIApi, Configuration, CreateApiDto } from './api'

const configuration = new Configuration()
const apiInstance = new APIApi(configuration)

let createApiDto: CreateApiDto //

const { status, data } = await apiInstance.apiControllerCreate(createApiDto)
```

### Parameters

| Name             | Type             | Description | Notes |
| ---------------- | ---------------- | ----------- | ----- |
| **createApiDto** | **CreateApiDto** |             |       |

### Return type

**ApiEntity**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **201**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiControllerFindAll**

> Array<ApiEntity> apiControllerFindAll()

### Example

```typescript
import { APIApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new APIApi(configuration)

const { status, data } = await apiInstance.apiControllerFindAll()
```

### Parameters

This endpoint does not have any parameters.

### Return type

**Array<ApiEntity>**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiControllerFindOne**

> ApiEntity apiControllerFindOne()

### Example

```typescript
import { APIApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new APIApi(configuration)

let id: string // (default to undefined)

const { status, data } = await apiInstance.apiControllerFindOne(id)
```

### Parameters

| Name   | Type         | Description | Notes                 |
| ------ | ------------ | ----------- | --------------------- |
| **id** | [**string**] |             | defaults to undefined |

### Return type

**ApiEntity**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiControllerGetInfo**

> OpenApiInfoResultDto apiControllerGetInfo()

Downloads the YAML/JSON at openapi_doc_url (server-side, bypassing browser CORS restrictions) and returns the info.title, info.description, and info.version fields.

### Example

```typescript
import { APIApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new APIApi(configuration)

let openapiDocUrl: string //URL of the remote OpenAPI document (default to undefined)

const { status, data } = await apiInstance.apiControllerGetInfo(openapiDocUrl)
```

### Parameters

| Name              | Type         | Description                        | Notes                 |
| ----------------- | ------------ | ---------------------------------- | --------------------- |
| **openapiDocUrl** | [**string**] | URL of the remote OpenAPI document | defaults to undefined |

### Return type

**OpenApiInfoResultDto**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                                            | Response headers |
| ----------- | ------------------------------------------------------ | ---------------- |
| **200**     |                                                        | -                |
| **400**     | Missing or invalid URL, or private/loopback address    | -                |
| **422**     | Could not parse the document or extract the info block | -                |
| **502**     | Remote URL could not be reached                        | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiControllerRemove**

> apiControllerRemove()

### Example

```typescript
import { APIApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new APIApi(configuration)

let id: string // (default to undefined)

const { status, data } = await apiInstance.apiControllerRemove(id)
```

### Parameters

| Name   | Type         | Description | Notes                 |
| ------ | ------------ | ----------- | --------------------- |
| **id** | [**string**] |             | defaults to undefined |

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
| **204**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiControllerUpdate**

> ApiEntity apiControllerUpdate(updateApiDto)

### Example

```typescript
import { APIApi, Configuration, UpdateApiDto } from './api'

const configuration = new Configuration()
const apiInstance = new APIApi(configuration)

let id: string // (default to undefined)
let updateApiDto: UpdateApiDto //

const { status, data } = await apiInstance.apiControllerUpdate(id, updateApiDto)
```

### Parameters

| Name             | Type             | Description | Notes                 |
| ---------------- | ---------------- | ----------- | --------------------- |
| **updateApiDto** | **UpdateApiDto** |             |                       |
| **id**           | [**string**]     |             | defaults to undefined |

### Return type

**ApiEntity**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
