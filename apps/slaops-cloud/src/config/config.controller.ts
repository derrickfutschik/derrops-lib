import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

import { config } from '@slaops/config'

const isSecret = (key: string) => {
  const k = key.toLowerCase()
  return (
    (k && k.includes('secret')) ||
    k.includes('password') ||
    k.includes('token') ||
    k.includes('email') ||
    k.includes('account') ||
    k.includes('credentials') ||
    k.includes('endpoint') ||
    k.includes('host') ||
    (k.includes('database') && k.includes('user')) ||
    (k.includes('db') && k.includes('user')) ||
    (k.includes('opensearch') && k.includes('user'))
  )
}

function maskConfig<T extends Record<string, unknown>>(obj: T): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, isSecret(key) ? '********' : String(value)]),
  )
}

@ApiTags('Config')
@Controller('config')
export class ConfigController {
  constructor() {}

  @Get()
  @ApiOperation({ summary: 'Get the config' })
  @ApiOkResponse({
    description: 'Masked config key-value pairs (sensitive values redacted)',
    schema: {
      type: 'object',
      additionalProperties: { type: 'string' },
      example: { 'app.name': 'SLAOps', 'aws.region': 'ap-southeast-2', 'db.host': '********' },
    },
  })
  getConfig(): Record<string, string | undefined> {
    return maskConfig(config)
  }
}
