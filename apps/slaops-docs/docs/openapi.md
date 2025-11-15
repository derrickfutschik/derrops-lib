# OpenAPI

**Pseudocode**

```
match(API) = host_shape(request.host)
          AND request.path starts with API.base_path

choose the API with the longest base_path

```

## Indexing Strategy

###

Only the `host_shape` and the `base_path` are indexed.

| Field        | Key Type      | Description                                    | Example                      |
| ------------ | ------------- | ---------------------------------------------- | ---------------------------- |
| `base_path`  | Partition Key | The base path from the OpenAPI specification   | `/v1/cloudtrail`             |
| `host_shape` | Sort Key      | The shape of the domain (replace vars with \*) | `cloudtrail.*.amazonaws.com` |

Take the example: `cloudtrail.ap-southeast-9.amazonaws.com`

- `[0]` cloudtrail
- `[1]` ap-southeast-9
- `[2]` amazonaws
- `[3]` com

```json
{
  "api_id": "aws-cloudtrail",
  "api_version": "1.0.0",

  // server
  "server_id": "aws-cloudtrail-https-1", // id of the server, this is the id of the server in the API specification if exists otherwise we generate it
  "server_scheme": "https", // schema/protocol
  "server_index": 0, // index of the server in the API specification

  //raw URL
  "raw_url": "https://cloudtrail.{region}.amazonaws.com",

  // public suffix + one label
  "dns_suffix": "amazonaws.com",

  // labels *before* the dns_suffix
  "subdomain_labels": ["cloudtrail", "{region}"],

  // which positions are fixed vs variable
  "fixed_labels": ["cloudtrail"],
  "var_labels": ["region"],

  // optional, for debugging/extra matching
  "host_template": "cloudtrail.{region}.amazonaws.com",

  // any variables are replaced with *
  "host_shape": "cloudtrail.*.amazonaws.com",

  // base path of the API
  "base_path": "/v1/cloudtrail"
}
```

When matching: `https://cloudtrail.ap-southeast-9.amazonaws.com/v1/cloudtrail/something/this/than`

All possible host_shapes for this URL are:

- `cloudtrail.*.amazonaws.com`
- `*.ap-southeast-9.amazonaws.com`

This is invalid:

- `*.*.amazonaws.com`

Because the only non variable label is the dns_suffix.

Then you would only need to look up `cloudtrail.*.amazonaws.com` & `*.ap-southeast-9.amazonaws.com`.
Then `cloudtrail.*.amazonaws.com` would match the `host_shape` for cloudtrail.

The search JSON then becomes:

You'd parse this into:

```json
{
  "raw_url": "https://cloudtrail.ap-southeast-9.amazonaws.com/v1/cloudtrail/something/this/than",
  "host": "cloudtrail.ap-southeast-9.amazonaws.com",
  "labels": ["cloudtrail", "ap-southeast-9", "amazonaws", "com"],
  "scheme": "https",
  "dns_suffix": "amazonaws.com",
  "subdomain_labels": ["cloudtrail", "ap-southeast-9"],
  "host_shape": ["cloudtrail.*.amazonaws.com", "*.ap-southeast-9.amazonaws.com"],
  "path": "v1/cloudtrail/something/this/than"
}
```

In most cases the `host_shape` will be enough to find the API alone

## Base Path

If there are multiple APIs on the same domain, with different base paths, then the base path will be used to find the API on the domain. All APIs will need to be returned which have a base path which is a substring of the path in the request. The latest version of all APIs are returned.

So as an example if there was the following request path:

`v1/shipping/customers/abcd/logout`

And there were the following base paths from given APIs:

| API Name     | Base Path                 |
| ------------ | ------------------------- |
| Customer API | `/v1/shipping/customers/` |
| Orders API   | `/v1/shipping/orders/`    |
| Products API | `/v1/shipping/products/`  |

Then the **Customer API** would be returned, as it is the longest base path that is a substring of the request path.

# Operation Matching

OpenAPI definitions can be too large to retrieve in one go. To minimize the size of the operations, the following format represents enough information to match the operation. So instead an `Operation` will become compacted to be stored into DynamoDB.

```json
{
  "operation_id": "logout",
  "variable_path": "{integer}/logout",
  "method": "POST",
  "model_indices": [0, 1, 3]
}
```

Now we need to represent the path more concisely:
`P => POST`
`{integer} => {i}`

Becomes:

```
P:{i}/logout
```

```json
{
  "p_k": "P:{i}/logout",
  "m_i": [0, 1, 3]
}
```

`p_k` is enough to match the operation. Then the model references stored at `m_i` can be used to lookup the models from the OpenAPI specification, hence only one more hop is needed to find the openapi definition.

| Shorthand | Full Name       | Description                                                                                                                          |
| --------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `o_i`     | `operation_id`  | The operation id from the OpenAPI specification.                                                                                     |
| `v_p`     | `variable_path` | The variable path from the OpenAPI specification.                                                                                    |
| `m`       | `method`        | The method from the OpenAPI specification (first character only).                                                                    |
| `m_i`     | `model_indices` | The indices of the models from the OpenAPI specification used by the method either in the body or elsewhere (0 = first in the spec). |
| `p_k`     | `partition_key` | The partition key for the operation. This is both sortable and is enough information to do the method matching.                      |

````


TODO need to create the schemas.

```mermaid
erDiagram
    Operation {
      STRING tenantId  "PK"
      STRING orderId   "SK"
      STRING status
      STRING createdAt
      NUMBER amount
      ARRAY  items
      NUMBER expiresAt
    }
````

## Enrichment

At a high level, the matching process is as follows to find an OpenAPI operation for a given request:

1. Request comes in from the client
2. Extract the domain, path and method from the request
3. Lookup all the API for the given domain & path
4. Find all operations for the given API
5. Match the request with the operation
6. Populate the Request into an `SLAOpsEnrichedLog`.
7. Index the `SLAOpsEnrichedLog` into Opensearch.

```mermaid flowchart

flowchart LR
    SpecAPI[Spec API]
    Database[Database]
    S3[S3 Bucket]

    SpecAPI --> Database
    SpecAPI --> S3
```

## Cron Updater

## Agentic Agent Updater

Proposal:

1. Called if API has not been updated for a long time.
2. Called if there has been issues with the API.

## Populating OpenAPI Specifications

### VIA API or CLI

The sla CLI can be used to populate an OpenAPI specification into the platform.

## Request

Specifying Credentials OAuth, or Header, as well as a request, this can be used to poll for API changes.

## Web search

Web-Agent will be used in an attempt to try and find the OpenAPI specification.

## API Finder

- domain
- basepath

## Operation Finder

For a given operation, need to lookup the paths based off of:

- domain
- version
- base path
- controllerpath

# OpenAPI Discovery

This component has the ability to based off of API calls, to generate an OpenAPI specification, even though one has not been found.

## OpenAPI Test Cases

| Service             | Type                   | URL Pattern                                               | Example                                             |
| ------------------- | ---------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| AWS S3              | Legacy path-style      | `https://s3.{region}.amazonaws.com`                       |                                                     |
| AWS S3              | Virtual Host style     | `https://{bucket}.s3.{region}.amazonaws.com`              | `https://my-bucket.s3.ap-southeast-2.amazonaws.com` |
| AWS S3              | Dural Stack            | `https://s3.dualstack.{region}.amazonaws.com`             |                                                     |
| REST API            |                        | `https://{restapi-id}.execute-api.{region}.amazonaws.com` |                                                     |
| STS                 | Global Legacy          | `https://sts.amazonaws.com`                               |                                                     |
| STS                 | Regional (recommended) | `https://sts.{region}.amazonaws.com`                      |                                                     |
| OpenSearch          |                        | `https://search-{domain}.{region}.es.amazonaws.com`       |                                                     |
| EventBridge Pipes   |                        | `https://pipes.{region}.amazonaws.com`                    |                                                     |
| Bedrock Runtime     |                        | `https://bedrock-runtime.{region}.amazonaws.com`          |                                                     |
| Bedrock Agents      |                        | `https://bedrock-agents-runtime.{region}.amazonaws.com`   |                                                     |
| CloudFront          | Global                 | `https://cloudfront.amazonaws.com`                        |                                                     |
| ECR Docker Registry |                        | `{aws_account}.dkr.ecr.{region}.amazonaws.com`            |                                                     |
| ECR Registries      |                        | `https://{account}.dkr.ecr.{region}.amazonaws.com`        |                                                     |
| Lambda (Invoke URL) |                        | `https://{api-id}.lambda-url.{region}.on.aws`             |                                                     |
