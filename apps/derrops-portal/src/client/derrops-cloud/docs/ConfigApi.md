# ConfigApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**configControllerGetConfig**](#configcontrollergetconfig) | **GET** /config | Get the config|

# **configControllerGetConfig**
> { [key: string]: string; } configControllerGetConfig()


### Example

```typescript
import {
    ConfigApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ConfigApi(configuration);

const { status, data } = await apiInstance.configControllerGetConfig();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**{ [key: string]: string; }**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Masked config key-value pairs (sensitive values redacted) |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

