# AegisRegisterDto

## Properties

| Name                  | Type       | Description                                                            | Notes                  |
| --------------------- | ---------- | ---------------------------------------------------------------------- | ---------------------- |
| **registrationToken** | **string** | One-time registration token issued when the Aegis instance was created | [default to undefined] |
| **jwksUrl**           | **string** | JWKS endpoint URL of the Aegis instance (must be HTTPS)                | [default to undefined] |

## Example

```typescript
import { AegisRegisterDto } from './api'

const instance: AegisRegisterDto = {
  registrationToken,
  jwksUrl,
}
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
