# CreateAegisInstanceDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **string** | Human-readable name for this Aegis instance | [default to undefined]
**url** | **string** | Base URL of the Aegis instance (must be HTTPS) | [default to undefined]
**jwksUrl** | **string** | JWKS endpoint URL of the Aegis instance (must be HTTPS) | [default to undefined]

## Example

```typescript
import { CreateAegisInstanceDto } from './api';

const instance: CreateAegisInstanceDto = {
    name,
    url,
    jwksUrl,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
