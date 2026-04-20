# UpdateCloudRelayConnectionDto

## Properties

| Name         | Type       | Description                                                                                              | Notes                             |
| ------------ | ---------- | -------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **name**     | **string** | New human-readable name for the connection.                                                              | [optional] [default to undefined] |
| **url**      | **string** | Updated base URL of the relay. Not applicable for platform-queue connections (no inbound URL).           | [optional] [default to undefined] |
| **aegis_id** | **string** | UUID of an AegisInstance to link. Must belong to the same tenant. Pass null to unlink the current Aegis. | [optional] [default to undefined] |

## Example

```typescript
import { UpdateCloudRelayConnectionDto } from './api'

const instance: UpdateCloudRelayConnectionDto = {
  name,
  url,
  aegis_id,
}
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
