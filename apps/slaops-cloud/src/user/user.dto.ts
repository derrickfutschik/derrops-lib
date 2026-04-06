/**
 * Represents a user on the platform.
 */
export type User = {
  sub: string
  username: string
  email: string
  email_verified: boolean
  iss: string
  aud: string
  token_use: 'access' | 'id'
  scope: string
  auth_time: number
  iat: number
  exp: number
  client_id: string
  userId: string
  'custom:tenant_id': string
}
