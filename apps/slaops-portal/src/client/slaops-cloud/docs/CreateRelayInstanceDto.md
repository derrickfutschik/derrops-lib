# CreateRelayInstanceDto

## Properties

| Name     | Type       | Description                                 | Notes                  |
| -------- | ---------- | ------------------------------------------- | ---------------------- |
| **name** | **string** | Human-readable name for this relay instance | [default to undefined] |
| **url**  | **string** | Base URL of the relay (must be HTTPS)       | [default to undefined] |

## Example

```typescript
import { CreateRelayInstanceDto } from './api'

const instance: CreateRelayInstanceDto = {
  name,
  url,
}
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
