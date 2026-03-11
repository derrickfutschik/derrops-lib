# CreateServiceDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**user_id** | **string** | User ID who owns this service | [default to undefined]
**name** | **string** | Service name | [default to undefined]
**endpoint** | **string** | Service endpoint URL | [default to undefined]
**openapi_doc_url** | **string** | OpenAPI document URL | [optional] [default to undefined]
**openapi_doc_content** | **string** | OpenAPI document content (stored as text) | [optional] [default to undefined]
**availability** | **number** | Service availability percentage | [optional] [default to undefined]
**response_time** | **number** | Average response time in milliseconds | [optional] [default to undefined]

## Example

```typescript
import { CreateServiceDto } from './api';

const instance: CreateServiceDto = {
    user_id,
    name,
    endpoint,
    openapi_doc_url,
    openapi_doc_content,
    availability,
    response_time,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
