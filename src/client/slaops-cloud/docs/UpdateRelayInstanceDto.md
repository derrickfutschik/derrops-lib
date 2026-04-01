# UpdateRelayInstanceDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **string** | Human-readable name for this relay instance | [optional] [default to undefined]
**url** | **string** | Base URL of the relay (must be HTTPS) | [optional] [default to undefined]
**aegisId** | **string** | UUID of the linked Aegis instance (must belong to the same tenant) | [optional] [default to undefined]

## Example

```typescript
import { UpdateRelayInstanceDto } from './api';

const instance: UpdateRelayInstanceDto = {
    name,
    url,
    aegisId,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
