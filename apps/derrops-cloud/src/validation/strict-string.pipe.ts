import { BadRequestException, ValidationPipe, ValidationPipeOptions } from '@nestjs/common'
import { ALLOW_LEADING_TRAILING_SPACE_KEY } from './allow-leading-trailing-space.decorator'

export class StrictStringPipe extends ValidationPipe {
  constructor(options?: ValidationPipeOptions) {
    super(options)
  }

  override async transform(value: unknown, metadata: import('@nestjs/common').ArgumentMetadata) {
    if (metadata.type === 'body' && value !== null && typeof value === 'object') {
      this.checkWhitespace(value as Record<string, unknown>, metadata.metatype)
    }
    return super.transform(value, metadata)
  }

  private checkWhitespace(body: Record<string, unknown>, metatype: unknown): void {
    if (!metatype || typeof metatype !== 'function') return

    const errors: string[] = []
    const proto = (metatype as { prototype?: object }).prototype

    for (const key of Object.keys(body)) {
      const value = body[key]
      if (typeof value !== 'string') continue

      const allowed = proto
        ? Reflect.getMetadata(ALLOW_LEADING_TRAILING_SPACE_KEY, proto, key)
        : false
      if (allowed) continue

      const hasLeading = value.length > 0 && value[0] === ' '
      const hasTrailing = value.length > 0 && value[value.length - 1] === ' '

      if (hasLeading && hasTrailing) {
        errors.push(`${key} must not have leading or trailing whitespace`)
      } else if (hasLeading) {
        errors.push(`${key} must not have leading whitespace`)
      } else if (hasTrailing) {
        errors.push(`${key} must not have trailing whitespace`)
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors)
    }
  }
}
