# IndexStatsResponseDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**totalDocuments** | **number** | Total indexed documents | [default to undefined]
**totalOperations** | **number** | Total operations across all specs | [default to undefined]
**uniqueProviders** | **number** | Number of unique providers | [default to undefined]
**uniqueTags** | **number** | Number of unique tags | [default to undefined]
**lastIndexedAt** | **string** | Last indexed timestamp | [optional] [default to undefined]

## Example

```typescript
import { IndexStatsResponseDto } from './api';

const instance: IndexStatsResponseDto = {
    totalDocuments,
    totalOperations,
    uniqueProviders,
    uniqueTags,
    lastIndexedAt,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
