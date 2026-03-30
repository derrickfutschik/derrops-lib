# AegisCreateResponseDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** |  | [default to undefined]
**tenant_id** | **string** |  | [default to undefined]
**name** | **string** |  | [default to undefined]
**url** | **string** |  | [default to undefined]
**jwks_url** | **string** |  | [default to undefined]
**status** | **string** |  | [default to undefined]
**created_at** | **string** |  | [default to undefined]
**updated_at** | **string** |  | [default to undefined]
**registrationToken** | **string** | One-time registration token — configure Aegis with this value. Not stored in plaintext. | [default to undefined]

## Example

```typescript
import { AegisCreateResponseDto } from './api';

const instance: AegisCreateResponseDto = {
    id,
    tenant_id,
    name,
    url,
    jwks_url,
    status,
    created_at,
    updated_at,
    registrationToken,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
