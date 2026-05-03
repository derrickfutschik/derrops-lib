import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import * as jwt from 'jsonwebtoken'
import { User } from '../user/user.dto'
import { IS_PUBLIC_KEY } from './public.decorator'
import { config } from '@derrops/config'
import { mockToken } from './auth.mock'

// TODO replace with this to remove duplication /derrops-platform/apps/derrops-cloud/src/user/user.dto.ts
interface JwtPayload {
  sub: string
  username?: string
  'cognito:username': string
  email: string
  iat: number
  exp: number
  aud: string
  iss: string
  email_verified: boolean
  token_use: 'access' | 'id'
  scope: string
  auth_time: number
  client_id: string
  userId: string
  'custom:tenant_id': string
  'custom:customer_id': string
  [key: string]: any
}

function getToken(request: Request) {
  const authHeader = (request.headers as any).authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedException(
      'No valid authorization header found. Authorization: Bearer XXX',
    )
  }

  const token = authHeader.substring(7)

  return token
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()

    // Allow access to Swagger documentation and static assets
    const url = request.url || request.path || ''

    if (
      url.startsWith('/docs') ||
      url === '/docs' ||
      url.includes('swagger') ||
      url.includes('api-docs') ||
      url === '/favicon.ico'
    ) {
      return true
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      return true
    }

    // const token = getToken(request)
    const token = config['app.auth.mock.enabled'] ? mockToken({}) : getToken(request)

    try {
      // Decode JWT without verification since API Gateway already validated it
      const payload = jwt.decode(token) as JwtPayload

      if (!payload) {
        throw new UnauthorizedException('Invalid token format')
      }

      const user: User = {
        ...payload,
        username: payload.username ?? payload['cognito:username']!,
        userId: payload.sub,
      }

      request.user = user

      return true
    } catch {
      throw new UnauthorizedException('Invalid token format')
    }
  }
}
