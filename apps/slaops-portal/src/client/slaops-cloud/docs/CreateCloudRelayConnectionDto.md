# CreateCloudRelayConnectionDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**type** | **string** | managed     — SLAOps-hosted Lambda relay. self-hosted — Customer-deployed relay on their own infrastructure. local-dev   — Developer local machine. delivery_mode is locked to platform-queue and an SQS FIFO queue is provisioned automatically. | [optional] [default to TypeEnum_Managed]
**name** | **string** | Human-readable name. Auto-generated if omitted. | [optional] [default to undefined]
**url** | **string** | Base URL of the relay instance. Required for direct and relay-queue modes, and for the HTTP path in hybrid mode. Not used for platform-queue connections (relay makes only outbound connections). | [optional] [default to undefined]
**delivery_mode** | **string** | direct          — slaops-cloud calls relay synchronously. relay-queue     — slaops-cloud submits to relay queue, polls relay for result. platform-queue  — relay polls slaops-cloud outbound. Use when relay cannot accept inbound connections. hybrid          — platform tries direct HTTP first, falls back to SQS on failure. Requires both url and sqs_queue_url. For local-dev relays this is always platform-queue regardless of what is sent. | [optional] [default to DeliveryModeEnum_Direct]
**sqs_queue_mode** | **string** | platform — SLAOps provisions and owns the SQS FIFO queue. relay    — Customer provisions the queue and grants sqs:SendMessage to the SLAOps platform role; provide relay_sqs_queue_url. Required when delivery_mode is platform-queue or hybrid. | [optional] [default to SqsQueueModeEnum_Platform]
**relay_sqs_queue_url** | **string** | Customer-owned SQS FIFO queue URL. Required when sqs_queue_mode&#x3D;relay. The customer must grant the SlaOpsSqsPublishRole sqs:SendMessage permission on this queue. | [optional] [default to undefined]
**aegis_id** | **string** | UUID of an AegisInstance to link to this connection. The Aegis must belong to the same tenant. Null or omitted means no Aegis is linked. | [optional] [default to undefined]

## Example

```typescript
import { CreateCloudRelayConnectionDto } from './api';

const instance: CreateCloudRelayConnectionDto = {
    type,
    name,
    url,
    delivery_mode,
    sqs_queue_mode,
    relay_sqs_queue_url,
    aegis_id,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
