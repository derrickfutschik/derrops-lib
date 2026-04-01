# CreateCloudRelayConnectionDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**type** | **string** | managed     — SLAOps-hosted Lambda relay. self-hosted — Customer-deployed relay on their own infrastructure. local-dev   — Developer local machine. delivery_mode is locked to platform-queue and an SQS FIFO queue is provisioned automatically. | [optional] [default to TypeEnum_Managed]
**name** | **string** | Human-readable name. Auto-generated for local-dev relays. | [optional] [default to undefined]
**url** | **string** | Base URL of the relay instance. Required for direct and relay-queue modes. Not used for platform-queue / local-dev relays (relay makes only outbound connections). | [optional] [default to undefined]
**sqs_queue_mode** | **string** | platform — SLAOps provisions the SQS FIFO queue (default). relay    — Customer provisions the queue; provide relay_sqs_queue_url. Only relevant for local-dev relay connections. | [optional] [default to SqsQueueModeEnum_Platform]
**relay_sqs_queue_url** | **string** | Customer-owned SQS FIFO queue URL. Required when sqs_queue_mode&#x3D;relay. The customer must grant the SlaOpsSqsPublishRole sqs:SendMessage permission on this queue. | [optional] [default to undefined]
**delivery_mode** | **string** | direct          — slaops-cloud calls relay synchronously. Relay must be reachable from slaops-cloud. relay-queue     — slaops-cloud submits to relay queue, polls relay for result. Relay must be reachable from slaops-cloud. platform-queue  — relay polls slaops-cloud outbound and posts results back. Use when relay cannot accept inbound connections. For local-dev relays this is always platform-queue regardless of what is sent. | [optional] [default to DeliveryModeEnum_Direct]

## Example

```typescript
import { CreateCloudRelayConnectionDto } from './api';

const instance: CreateCloudRelayConnectionDto = {
    type,
    name,
    url,
    sqs_queue_mode,
    relay_sqs_queue_url,
    delivery_mode,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
