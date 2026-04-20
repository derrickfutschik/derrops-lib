# CloudRelayJob

## Properties

| Name              | Type       | Description                                                                                                                                                      | Notes                             |
| ----------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **id**            | **string** |                                                                                                                                                                  | [default to undefined]            |
| **connection_id** | **string** |                                                                                                                                                                  | [default to undefined]            |
| **tenant_id**     | **string** |                                                                                                                                                                  | [default to undefined]            |
| **user_id**       | **string** |                                                                                                                                                                  | [default to undefined]            |
| **delivery_mode** | **string** |                                                                                                                                                                  | [default to undefined]            |
| **status**        | **string** |                                                                                                                                                                  | [default to undefined]            |
| **request**       | **object** | Full CloudProxyRequestDto payload. Stored for platform-queue (relay reads it when claiming) and direct mode. Null for relay-queue (relay owns the request data). | [optional] [default to undefined] |
| **relay_job_id**  | **string** | Relay-internal job ID. Set for relay-queue mode only.                                                                                                            | [optional] [default to undefined] |
| **result**        | **object** | CloudProxyResponseDto or CloudProxyErrorDto. Set once job completes.                                                                                             | [optional] [default to undefined] |
| **claimed_at**    | **string** |                                                                                                                                                                  | [optional] [default to undefined] |
| **completed_at**  | **string** |                                                                                                                                                                  | [optional] [default to undefined] |
| **created_at**    | **string** |                                                                                                                                                                  | [default to undefined]            |
| **expires_at**    | **string** |                                                                                                                                                                  | [default to undefined]            |

## Example

```typescript
import { CloudRelayJob } from './api'

const instance: CloudRelayJob = {
  id,
  connection_id,
  tenant_id,
  user_id,
  delivery_mode,
  status,
  request,
  relay_job_id,
  result,
  claimed_at,
  completed_at,
  created_at,
  expires_at,
}
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
