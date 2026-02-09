# OpenApiSearchResponseDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**total** | **number** | Total matching documents | [default to undefined]
**hits** | [**Array&lt;OpenApiSearchHit&gt;**](OpenApiSearchHit.md) | Search hits | [default to undefined]
**aggregations** | [**SearchAggregations**](SearchAggregations.md) | Aggregations/facets | [optional] [default to undefined]
**took** | **number** | Query execution time in milliseconds | [default to undefined]

## Example

```typescript
import { OpenApiSearchResponseDto } from './api';

const instance: OpenApiSearchResponseDto = {
    total,
    hits,
    aggregations,
    took,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
