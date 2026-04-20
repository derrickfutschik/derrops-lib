# UpdateAegisInstanceDto

## Properties

| Name        | Type       | Description                                             | Notes                             |
| ----------- | ---------- | ------------------------------------------------------- | --------------------------------- |
| **name**    | **string** | Human-readable name for this Aegis instance             | [optional] [default to undefined] |
| **url**     | **string** | Base URL of the Aegis instance (must be HTTPS)          | [optional] [default to undefined] |
| **jwksUrl** | **string** | JWKS endpoint URL of the Aegis instance (must be HTTPS) | [optional] [default to undefined] |

## Example

```typescript
import { UpdateAegisInstanceDto } from './api'

const instance: UpdateAegisInstanceDto = {
  name,
  url,
  jwksUrl,
}
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
