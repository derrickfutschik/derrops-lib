# OpenApiInfoResultDto

## Properties

| Name            | Type       | Description                                     | Notes                             |
| --------------- | ---------- | ----------------------------------------------- | --------------------------------- |
| **title**       | **string** | OpenAPI info.title                              | [default to undefined]            |
| **description** | **string** | OpenAPI info.description                        | [optional] [default to undefined] |
| **version**     | **string** | OpenAPI info.version                            | [optional] [default to undefined] |
| **rawContent**  | **string** | Raw YAML/JSON spec content fetched from the URL | [default to undefined]            |

## Example

```typescript
import { OpenApiInfoResultDto } from './api'

const instance: OpenApiInfoResultDto = {
  title,
  description,
  version,
  rawContent,
}
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
