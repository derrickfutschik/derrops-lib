import * as jwt from 'jsonwebtoken'

describe('JWT Token Generator', () => {
  it('should generate encoded JWT with Cognito payload', () => {
    const cognitoPayload = {
      sub: '12345678-1234-1234-1234-123456789012',
      'cognito:username': 'derrops',
      email: 'derrops@derrops.com',
      email_verified: true,
      iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ExamplePool',
      aud: '1example23456789',
      token_use: 'access',
      scope: 'aws.cognito.signin.user.admin',
      auth_time: 1643723400,
      iat: 1643723400,
      exp: 1643727000,
      client_id: '1example23456789',
    }

    const secret = 'test-secret'
    const encodedToken = jwt.sign(cognitoPayload, secret, {
      algorithm: 'HS256',
    })

    console.log('Generated JWT Token:')
    console.log(encodedToken)
    console.log('\nAuthorization Header:')
    console.log(`Bearer ${encodedToken}`)

    // Verify the token can be decoded
    const decoded = jwt.decode(encodedToken) as any
    expect(decoded['cognito:username']).toBe('derrops')
    expect(decoded.sub).toBe('12345678-1234-1234-1234-123456789012')
    expect(decoded.email).toBe('derrops@derrops.com')
  })
})
