# Service


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** | Primary key in database | [default to undefined]
**user_id** | **string** | User ID who owns this service | [default to undefined]
**name** | **string** | Service name | [default to undefined]
**endpoint** | **string** | Service endpoint URL | [default to undefined]
**openapi_doc_url** | **string** | OpenAPI document URL | [optional] [default to undefined]
**openapi_doc_content** | **string** | OpenAPI document content (stored as text) | [optional] [default to undefined]
**availability** | **number** | Service availability percentage | [optional] [default to undefined]
**response_time** | **number** | Average response time in milliseconds | [optional] [default to undefined]
**created_at** | **string** | Date when the service was created | [default to undefined]
**updated_at** | **string** | Date when the service was last updated | [default to undefined]

## Example

```typescript
import { Service } from './api';

const instance: Service = {
    id,
    user_id,
    name,
    endpoint,
    openapi_doc_url,
    openapi_doc_content,
    availability,
    response_time,
    created_at,
    updated_at,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
