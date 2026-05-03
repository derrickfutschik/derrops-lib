# CreateCloudRelayConnectionResponseDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** |  | [default to undefined]
**tenant_id** | **string** |  | [default to undefined]
**name** | **string** |  | [default to undefined]
**url** | **string** | Base URL of the relay instance. Used for direct and relay-queue modes. For platform-queue mode, the relay is not called inbound — leave this as the relay identifier URL. | [default to undefined]
**type** | **string** | managed     — Derrops-hosted Lambda relay. self-hosted — Customer-deployed relay on their own infrastructure. local-dev   — Developer local machine. delivery_mode is locked to platform-queue. An SQS FIFO queue is provisioned automatically. | [default to TypeEnum_Managed]
**delivery_mode** | **string** | direct         — derrops-cloud calls relay synchronously. Relay must be reachable from derrops-cloud. relay-queue    — derrops-cloud submits to relay queue, polls relay for result. Relay must be reachable from derrops-cloud. platform-queue — relay polls derrops-cloud outbound and posts results back. Use when relay cannot accept inbound connections. hybrid         — platform tries direct HTTP first; falls back to platform-queue on failure. Requires both url and sqs_queue_url. | [default to undefined]
**sqs_queue_mode** | **string** | platform — Derrops provisions and owns the SQS FIFO queue (default for local-dev). relay    — Customer provisions the queue in their own AWS account and grants the DerropsSqsPublishRole SendMessage access. Use relay mode when the customer\&#39;s network cannot reach SQS endpoints in the Derrops account. | [optional] [default to undefined]
**sqs_queue_url** | **string** | SQS FIFO queue URL for this relay connection. platform mode: provisioned by derrops-cloud and stored here. relay mode: provided by the customer at registration time. | [optional] [default to undefined]
**sqs_region** | **string** | AWS region of the SQS queue. | [optional] [default to undefined]
**aegis_id** | **string** | UUID of the linked AegisInstance. Optional — null means no Aegis for this connection. | [optional] [default to undefined]
**iam_user_arn** | **string** | ARN of the IAM user provisioned for relay SQS queue access (sqs_queue_mode&#x3D;platform only). Null until IAM provisioning is implemented. | [optional] [default to undefined]
**iam_access_key_id** | **string** | Access key ID of the IAM credential created for the relay. Stored for operator reference only — the secret access key is never stored. | [optional] [default to undefined]
**api_key** | **string** | API key for relay authentication. direct/relay-queue: derrops-cloud sends this as Bearer token to the relay. platform-queue: relay sends this as Bearer token when polling derrops-cloud. Configure the relay with RELAY_API_KEY (inbound) or RELAY_PLATFORM_TOKEN (outbound polling). | [default to undefined]
**created_at** | **string** |  | [default to undefined]
**updated_at** | **string** |  | [default to undefined]
**iam_access_key_id_created** | **string** | IAM access key ID for the provisioned relay IAM user (sqs_queue_mode&#x3D;platform only). Returned once — not stored. Null until IAM provisioning is implemented. | [optional] [default to undefined]
**iam_secret_access_key** | **string** | IAM secret access key for the provisioned relay IAM user (sqs_queue_mode&#x3D;platform only). Returned once — never stored. Null until IAM provisioning is implemented. | [optional] [default to undefined]
**aegis_registration_token** | **string** | One-time Aegis registration token, returned only when a new Aegis instance was registered as part of this connection creation. Never returned again. | [optional] [default to undefined]

## Example

```typescript
import { CreateCloudRelayConnectionResponseDto } from './api';

const instance: CreateCloudRelayConnectionResponseDto = {
    id,
    tenant_id,
    name,
    url,
    type,
    delivery_mode,
    sqs_queue_mode,
    sqs_queue_url,
    sqs_region,
    aegis_id,
    iam_user_arn,
    iam_access_key_id,
    api_key,
    created_at,
    updated_at,
    iam_access_key_id_created,
    iam_secret_access_key,
    aegis_registration_token,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
