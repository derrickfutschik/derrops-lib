# OpenApiSearchHit

## Properties

| Name           | Type       | Description            | Notes                             |
| -------------- | ---------- | ---------------------- | --------------------------------- |
| **document**   | **object** | The matched document   | [default to undefined]            |
| **score**      | **number** | Search relevance score | [default to undefined]            |
| **highlights** | **object** | Highlighted matches    | [optional] [default to undefined] |

## Example

```typescript
import { OpenApiSearchHit } from './api'

const instance: OpenApiSearchHit = {
  document,
  score,
  highlights,
}
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
