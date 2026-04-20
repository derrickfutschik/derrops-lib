# CloudRelayApi

All URIs are relative to _http://localhost_

| Method                                                                                      | HTTP request                                       | Description                                                                 |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------- |
| [**cloudRelayControllerClaimNextJob**](#cloudrelaycontrollerclaimnextjob)                   | **GET** /cloud-relay/queue/next                    | Claim the next pending platform-queue job (called by the relay)             |
| [**cloudRelayControllerCreateConnection**](#cloudrelaycontrollercreateconnection)           | **POST** /cloud-relay/connection                   | Register a new relay connection                                             |
| [**cloudRelayControllerDeleteConnection**](#cloudrelaycontrollerdeleteconnection)           | **DELETE** /cloud-relay/connection/{id}            | Delete a relay connection, its SQS queue, and IAM user (if any)             |
| [**cloudRelayControllerDeliverJobResult**](#cloudrelaycontrollerdeliverjobresult)           | **POST** /cloud-relay/job/{id}/result              | Deliver the result of a platform-queue job (called by the relay)            |
| [**cloudRelayControllerEnqueueJob**](#cloudrelaycontrollerenqueuejob)                       | **POST** /cloud-relay/job                          | Submit a proxy job                                                          |
| [**cloudRelayControllerFindAllConnections**](#cloudrelaycontrollerfindallconnections)       | **GET** /cloud-relay/connection                    | List relay connections for the authenticated user\&#39;s tenant             |
| [**cloudRelayControllerGetJob**](#cloudrelaycontrollergetjob)                               | **GET** /cloud-relay/job/{id}                      | Poll for the result of a proxy job                                          |
| [**cloudRelayControllerGetJwks**](#cloudrelaycontrollergetjwks)                             | **GET** /cloud-relay/.well-known/jwks.json         | Vendor JWKS endpoint (used by relays and Aegis to validate platform JWTs)   |
| [**cloudRelayControllerHealthCheckConnection**](#cloudrelaycontrollerhealthcheckconnection) | **POST** /cloud-relay/connection/{id}/health-check | Test HTTP reachability for a direct or hybrid relay connection              |
| [**cloudRelayControllerTestQueueConnection**](#cloudrelaycontrollertestqueueconnection)     | **POST** /cloud-relay/connection/{id}/test-queue   | Test SQS queue connectivity for a platform-queue or hybrid relay connection |
| [**cloudRelayControllerUpdateConnection**](#cloudrelaycontrollerupdateconnection)           | **PATCH** /cloud-relay/connection/{id}             | Update a relay connection (name, URL, linked Aegis)                         |

# **cloudRelayControllerClaimNextJob**

> CloudRelayJob cloudRelayControllerClaimNextJob()

The relay polls this endpoint to claim jobs for legacy HTTP-polling connections. SQS-enabled relays (local-dev) receive jobs via SQS long-poll instead. Authenticate with the connection api_key as a Bearer token.

### Example

```typescript
import { CloudRelayApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new CloudRelayApi(configuration)

let authorization: string //Bearer <connection api_key> (default to undefined)

const { status, data } = await apiInstance.cloudRelayControllerClaimNextJob(authorization)
```

### Parameters

| Name              | Type         | Description                       | Notes                 |
| ----------------- | ------------ | --------------------------------- | --------------------- |
| **authorization** | [**string**] | Bearer &lt;connection api_key&gt; | defaults to undefined |

### Return type

**CloudRelayJob**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description                                                          | Response headers |
| ----------- | -------------------------------------------------------------------- | ---------------- |
| **200**     | Job claimed — execute and POST result to /cloud-relay/job/:id/result | -                |
| **204**     | No pending jobs                                                      | -                |
| **401**     | Invalid api_key                                                      | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **cloudRelayControllerCreateConnection**

> CreateCloudRelayConnectionResponseDto cloudRelayControllerCreateConnection(createCloudRelayConnectionDto)

Creates a relay connection. For platform-queue and hybrid delivery modes, an SQS FIFO queue is provisioned automatically (sqs_queue_mode=platform) or the customer-provided queue URL is stored. The response includes one-time credentials (IAM access key, Aegis registration token) that are never returned again. tenantId and userId are read from the verified Cognito id_token — no client-supplied headers are trusted.

### Example

```typescript
import { CloudRelayApi, Configuration, CreateCloudRelayConnectionDto } from './api'

const configuration = new Configuration()
const apiInstance = new CloudRelayApi(configuration)

let createCloudRelayConnectionDto: CreateCloudRelayConnectionDto //

const { status, data } = await apiInstance.cloudRelayControllerCreateConnection(
  createCloudRelayConnectionDto,
)
```

### Parameters

| Name                              | Type                              | Description | Notes |
| --------------------------------- | --------------------------------- | ----------- | ----- |
| **createCloudRelayConnectionDto** | **CreateCloudRelayConnectionDto** |             |       |

### Return type

**CreateCloudRelayConnectionResponseDto**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **201**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **cloudRelayControllerDeleteConnection**

> CloudRelayControllerDeleteConnection200Response cloudRelayControllerDeleteConnection()

### Example

```typescript
import { CloudRelayApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new CloudRelayApi(configuration)

let id: string //Connection UUID (default to undefined)

const { status, data } = await apiInstance.cloudRelayControllerDeleteConnection(id)
```

### Parameters

| Name   | Type         | Description     | Notes                 |
| ------ | ------------ | --------------- | --------------------- |
| **id** | [**string**] | Connection UUID | defaults to undefined |

### Return type

**CloudRelayControllerDeleteConnection200Response**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |
| **404**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **cloudRelayControllerDeliverJobResult**

> CloudRelayJob cloudRelayControllerDeliverJobResult(body)

After executing a claimed job, the relay posts the result here. Set `failed: true` to mark the job as failed.

### Example

```typescript
import { CloudRelayApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new CloudRelayApi(configuration)

let id: string //Job UUID (from GET /cloud-relay/queue/next or SQS message body) (default to undefined)
let authorization: string //Bearer <connection api_key> (default to undefined)
let body: object //

const { status, data } = await apiInstance.cloudRelayControllerDeliverJobResult(
  id,
  authorization,
  body,
)
```

### Parameters

| Name              | Type         | Description                                                     | Notes                 |
| ----------------- | ------------ | --------------------------------------------------------------- | --------------------- |
| **body**          | **object**   |                                                                 |                       |
| **id**            | [**string**] | Job UUID (from GET /cloud-relay/queue/next or SQS message body) | defaults to undefined |
| **authorization** | [**string**] | Bearer &lt;connection api_key&gt;                               | defaults to undefined |

### Return type

**CloudRelayJob**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description     | Response headers |
| ----------- | --------------- | ---------------- |
| **200**     |                 | -                |
| **401**     | Invalid api_key | -                |
| **404**     | Job not found   | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **cloudRelayControllerEnqueueJob**

> CloudRelayJob cloudRelayControllerEnqueueJob(createCloudRelayJobDto)

slaops-cloud routes the request via the connection delivery_mode. direct: result is returned inline (completed immediately). relay-queue/platform-queue: job is pending — poll GET /cloud-relay/job/:id for the result.

### Example

```typescript
import { CloudRelayApi, Configuration, CreateCloudRelayJobDto } from './api'

const configuration = new Configuration()
const apiInstance = new CloudRelayApi(configuration)

let createCloudRelayJobDto: CreateCloudRelayJobDto //

const { status, data } = await apiInstance.cloudRelayControllerEnqueueJob(createCloudRelayJobDto)
```

### Parameters

| Name                       | Type                       | Description | Notes |
| -------------------------- | -------------------------- | ----------- | ----- |
| **createCloudRelayJobDto** | **CreateCloudRelayJobDto** |             |       |

### Return type

**CloudRelayJob**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description                                  | Response headers |
| ----------- | -------------------------------------------- | ---------------- |
| **201**     |                                              | -                |
| **404**     | Connection not found                         | -                |
| **503**     | Relay unreachable (direct/relay-queue modes) | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **cloudRelayControllerFindAllConnections**

> Array<CloudRelayConnection> cloudRelayControllerFindAllConnections()

### Example

```typescript
import { CloudRelayApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new CloudRelayApi(configuration)

const { status, data } = await apiInstance.cloudRelayControllerFindAllConnections()
```

### Parameters

This endpoint does not have any parameters.

### Return type

**Array<CloudRelayConnection>**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **cloudRelayControllerGetJob**

> CloudRelayJob cloudRelayControllerGetJob()

For relay-queue mode, slaops-cloud syncs status from the relay on each poll. For platform-queue and direct modes, returns the stored job state.

### Example

```typescript
import { CloudRelayApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new CloudRelayApi(configuration)

let id: string //Job UUID returned by POST /cloud-relay/job (default to undefined)

const { status, data } = await apiInstance.cloudRelayControllerGetJob(id)
```

### Parameters

| Name   | Type         | Description                                | Notes                 |
| ------ | ------------ | ------------------------------------------ | --------------------- |
| **id** | [**string**] | Job UUID returned by POST /cloud-relay/job | defaults to undefined |

### Return type

**CloudRelayJob**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |
| **404**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **cloudRelayControllerGetJwks**

> CloudRelayControllerGetJwks200Response cloudRelayControllerGetJwks()

### Example

```typescript
import { CloudRelayApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new CloudRelayApi(configuration)

const { status, data } = await apiInstance.cloudRelayControllerGetJwks()
```

### Parameters

This endpoint does not have any parameters.

### Return type

**CloudRelayControllerGetJwks200Response**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **cloudRelayControllerHealthCheckConnection**

> CloudRelayControllerHealthCheckConnection200Response cloudRelayControllerHealthCheckConnection()

Makes an authenticated GET to <relay-url>/health and returns latency or error.

### Example

```typescript
import { CloudRelayApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new CloudRelayApi(configuration)

let id: string //Connection UUID (default to undefined)

const { status, data } = await apiInstance.cloudRelayControllerHealthCheckConnection(id)
```

### Parameters

| Name   | Type         | Description     | Notes                 |
| ------ | ------------ | --------------- | --------------------- |
| **id** | [**string**] | Connection UUID | defaults to undefined |

### Return type

**CloudRelayControllerHealthCheckConnection200Response**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |
| **404**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **cloudRelayControllerTestQueueConnection**

> CloudRelayControllerTestQueueConnection200Response cloudRelayControllerTestQueueConnection()

Sends a canary message to the connection\'s SQS queue and verifies the send succeeds. Validates that the platform role has sqs:SendMessage permission on the queue.

### Example

```typescript
import { CloudRelayApi, Configuration } from './api'

const configuration = new Configuration()
const apiInstance = new CloudRelayApi(configuration)

let id: string //Connection UUID (default to undefined)

const { status, data } = await apiInstance.cloudRelayControllerTestQueueConnection(id)
```

### Parameters

| Name   | Type         | Description     | Notes                 |
| ------ | ------------ | --------------- | --------------------- |
| **id** | [**string**] | Connection UUID | defaults to undefined |

### Return type

**CloudRelayControllerTestQueueConnection200Response**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |
| **404**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **cloudRelayControllerUpdateConnection**

> CloudRelayConnection cloudRelayControllerUpdateConnection(updateCloudRelayConnectionDto)

### Example

```typescript
import { CloudRelayApi, Configuration, UpdateCloudRelayConnectionDto } from './api'

const configuration = new Configuration()
const apiInstance = new CloudRelayApi(configuration)

let id: string //Connection UUID (default to undefined)
let updateCloudRelayConnectionDto: UpdateCloudRelayConnectionDto //

const { status, data } = await apiInstance.cloudRelayControllerUpdateConnection(
  id,
  updateCloudRelayConnectionDto,
)
```

### Parameters

| Name                              | Type                              | Description     | Notes                 |
| --------------------------------- | --------------------------------- | --------------- | --------------------- |
| **updateCloudRelayConnectionDto** | **UpdateCloudRelayConnectionDto** |                 |                       |
| **id**                            | [**string**]                      | Connection UUID | defaults to undefined |

### Return type

**CloudRelayConnection**

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
| ----------- | ----------- | ---------------- |
| **200**     |             | -                |
| **404**     |             | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
