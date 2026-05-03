# VersionFetchState


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**strategy** | **string** | manual    — spec is uploaded manually via the portal or pre-signed URL. url_fetch — platform fetches the spec from fetch_url on a schedule. | [optional] [default to StrategyEnum_Manual]
**url** | **string** | URL the platform fetches the spec from (url_fetch strategy only). Must be publicly accessible or reachable from the Derrops egress IP range. | [optional] [default to undefined]
**cron** | **string** | Cron expression defining the fetch schedule (url_fetch strategy only). Defaults to config[oaspec.url-fetch.default-cron] when not specified. | [optional] [default to undefined]
**lastAt** | **string** | Timestamp of the last fetch attempt | [optional] [default to undefined]
**lastStatus** | **string** | Outcome of the last fetch attempt | [optional] [default to undefined]
**lastError** | **string** | Error message from the last failed fetch attempt | [optional] [default to undefined]
**consecutiveFailures** | **number** | Consecutive fetch failure count. When this reaches config[oaspec.url-fetch.backoff-threshold] the scheduler reduces to weekly cadence. | [optional] [default to undefined]

## Example

```typescript
import { VersionFetchState } from './api';

const instance: VersionFetchState = {
    strategy,
    url,
    cron,
    lastAt,
    lastStatus,
    lastError,
    consecutiveFailures,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
