# CreateApiDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **string** |  | [default to undefined]
**description** | **string** |  | [optional] [default to undefined]
**externalUrl** | **string** |  | [optional] [default to undefined]
**versionStrategy** | **string** |  | [optional] [default to VersionStrategyEnum_Manual]
**fetchCron** | **string** | Cron schedule for url_fetch strategy (UTC). Uses platform default when omitted. | [optional] [default to undefined]
**fetchUrl** | **string** | URL to fetch the spec from (url_fetch strategy only) | [optional] [default to undefined]

## Example

```typescript
import { CreateApiDto } from './api';

const instance: CreateApiDto = {
    name,
    description,
    externalUrl,
    versionStrategy,
    fetchCron,
    fetchUrl,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
