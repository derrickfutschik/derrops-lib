import * as jwt from 'jsonwebtoken'

import { configAtPrefix, mapKeysToLastSegment } from '@derrops/config'
import { User } from '../user/user.dto'

export function mockToken(payload: Partial<User>): string {
  const mockPayload = configAtPrefix('app.auth.mock.payload')

  const cognitoPayload: Partial<User> = {
    ...mapKeysToLastSegment(mockPayload),
    ...payload,
    userId: payload.sub,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  }

  const secret = 'test-secret'
  const encodedToken = jwt.sign(cognitoPayload, secret, {
    algorithm: 'HS256',
  })

  return encodedToken
}
