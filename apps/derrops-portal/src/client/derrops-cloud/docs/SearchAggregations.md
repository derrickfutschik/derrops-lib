# SearchAggregations


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**providers** | [**Array&lt;AggregationBucket&gt;**](AggregationBucket.md) | Provider aggregations | [default to undefined]
**tags** | [**Array&lt;AggregationBucket&gt;**](AggregationBucket.md) | Tag aggregations | [default to undefined]
**methods** | [**Array&lt;AggregationBucket&gt;**](AggregationBucket.md) | HTTP method aggregations | [default to undefined]
**pathPrefixes** | [**Array&lt;AggregationBucket&gt;**](AggregationBucket.md) | Path prefix aggregations | [default to undefined]

## Example

```typescript
import { SearchAggregations } from './api';

const instance: SearchAggregations = {
    providers,
    tags,
    methods,
    pathPrefixes,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
