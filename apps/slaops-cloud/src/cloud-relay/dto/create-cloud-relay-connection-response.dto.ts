import { ApiPropertyOptional } from '@nestjs/swagger'
import { CloudRelayConnection } from '../entities/cloud-relay-connection.entity'

/**
 * Response returned by POST /cloud-relay/connection.
 * Extends the persisted CloudRelayConnection with optional one-time credentials
 * that are never stored and never returned again after this response.
 */
export class CreateCloudRelayConnectionResponseDto extends CloudRelayConnection {
  @ApiPropertyOptional({
    description:
      'IAM access key ID for the provisioned relay IAM user (sqs_queue_mode=platform only). ' +
      'Returned once — not stored. Null until IAM provisioning is implemented.',
    example: 'AKIAIOSFODNN7EXAMPLE',
  })
  iam_access_key_id_created?: string

  @ApiPropertyOptional({
    description:
      'IAM secret access key for the provisioned relay IAM user (sqs_queue_mode=platform only). ' +
      'Returned once — never stored. Null until IAM provisioning is implemented.',
    example: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  })
  iam_secret_access_key?: string

  @ApiPropertyOptional({
    description:
      'One-time Aegis registration token, returned only when a new Aegis instance ' +
      'was registered as part of this connection creation. Never returned again.',
    example: 'eyJhbGciOiJSUzI1NiJ9...',
  })
  aegis_registration_token?: string
}
