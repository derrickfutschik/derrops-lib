# CreateCloudRelayJobDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**connectionId** | **string** | ID of the relay connection that should execute this job | [default to undefined]
**request** | **object** | Full CloudProxyRequestDto payload (HAR request + optional templateContext) | [default to undefined]

## Example

```typescript
import { CreateCloudRelayJobDto } from './api';

const instance: CreateCloudRelayJobDto = {
    connectionId,
    request,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
