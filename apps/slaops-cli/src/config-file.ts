import * as path from 'path'
import { SLAOPS_DIR, DEFAULT_PROFILE, getSection, setSection } from './profile-store'

/**
 * ~/.slaops/config — non-sensitive relay configuration, mode 0644.
 *
 * Mirrors the role of ~/.aws/config in the AWS CLI: stores profile-level
 * configuration that is not time-limited and does not require strict
 * file permissions. Safe to back up or version-control (minus platform_url
 * if it contains an internal hostname).
 *
 * Stored fields per profile:
 *   platform_url        — slaops-cloud base URL
 *   relay_id            — relay UUID assigned at registration
 *   relay_sqs_queue_url — dedicated SQS queue URL for this relay
 *   relay_sqs_region    — AWS region of the SQS queue
 *   identity_pool_id    — Cognito Identity Pool ID for AWS credential exchange
 *   cognito_region      — AWS region of the Cognito User Pool and Identity Pool
 *   user_pool_id        — Cognito User Pool ID (used as Identity Pool provider key)
 */
export interface RelayConfig {
  platform_url: string
  relay_id: string
  relay_sqs_queue_url: string
  relay_sqs_region: string
  identity_pool_id: string
  cognito_region: string
  user_pool_id: string
}

export const CONFIG_FILE = path.join(SLAOPS_DIR, 'config')

export function getConfigProfile(profile = DEFAULT_PROFILE): Partial<RelayConfig> | undefined {
  return getSection(CONFIG_FILE, profile) as Partial<RelayConfig> | undefined
}

export function setConfigProfile(values: Partial<RelayConfig>, profile = DEFAULT_PROFILE): void {
  setSection(CONFIG_FILE, values as Record<string, string>, profile, 0o644)
}
