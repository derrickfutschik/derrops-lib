# ApiEntity


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** |  | [default to undefined]
**tenantId** | **string** |  | [default to undefined]
**name** | **string** |  | [default to undefined]
**description** | **string** |  | [optional] [default to undefined]
**externalUrl** | **string** | External URL where the spec can be found or fetched from | [optional] [default to undefined]
**specType** | **string** | Spec format type | [default to 'openapi']
**managementMode** | **string** | private  — tenant owns and manages this spec. platform — tenant has adopted a SLAOps-managed spec from the global catalogue. | [default to ManagementModeEnum_Private]
**createdAt** | **string** |  | [default to undefined]
**updatedAt** | **string** |  | [default to undefined]
**oaSpec** | [**OaSpecRef**](OaSpecRef.md) |  | [default to undefined]
**fetch** | [**VersionFetchState**](VersionFetchState.md) |  | [default to undefined]

## Example

```typescript
import { ApiEntity } from './api';

const instance: ApiEntity = {
    id,
    tenantId,
    name,
    description,
    externalUrl,
    specType,
    managementMode,
    createdAt,
    updatedAt,
    oaSpec,
    fetch,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
