# OaSpecRef


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**bucket** | **string** | S3 bucket where the raw spec is stored | [optional] [default to undefined]
**key** | **string** | S3 object key — {tenantId}/APIs/{provider}/{service}/{version}/openapi.yaml | [optional] [default to undefined]
**latestVersion** | **string** | Latest indexed spec version string (e.g. \&quot;3.1.0\&quot;) | [optional] [default to undefined]
**globalOpensearchId** | **string** | OpenSearch document ID of the latest spec in the global catalogue index | [optional] [default to undefined]
**operationCount** | **number** | Number of operations in the latest indexed spec | [optional] [default to undefined]
**serverCount** | **number** | Number of servers in the latest indexed spec | [optional] [default to undefined]
**parameterCount** | **number** | Number of unique parameters in the latest indexed spec | [optional] [default to undefined]
**modelCount** | **number** | Number of schema models in the latest indexed spec | [optional] [default to undefined]
**lastIndexedAt** | **string** | Timestamp of the last successful indexing run | [optional] [default to undefined]

## Example

```typescript
import { OaSpecRef } from './api';

const instance: OaSpecRef = {
    bucket,
    key,
    latestVersion,
    globalOpensearchId,
    operationCount,
    serverCount,
    parameterCount,
    modelCount,
    lastIndexedAt,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
