import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import { env } from '../env'
import type { CognitoTokenPayload, RequestedEndpoint } from './cedar-entity.builder'
import { buildEntities } from './cedar-entity.builder'
import { buildContext } from './cedar-context.builder'

const HTTP_METHOD_TO_ACTION: Record<string, string> = {
  GET:     'httpGet',
  HEAD:    'httpHead',
  OPTIONS: 'httpOptions',
  POST:    'httpPost',
  PUT:     'httpPut',
  PATCH:   'httpPatch',
  DELETE:  'httpDelete',
}

export interface AuthorizationResult {
  allowed: boolean
  determiningPolicies: string[]
  reason?: string
}

@Injectable()
export class CedarPolicyService implements OnModuleInit {
  private readonly logger = new Logger(CedarPolicyService.name)

  /** Combined Cedar policy text (all loaded .cedar files concatenated). */
  private policyText = ''
  /** Parsed Cedar schema object (JSON format). */
  private schema: Record<string, unknown> | null = null
  /** Whether Cedar loaded successfully with at least an empty policy set. */
  private loaded = false

  async onModuleInit(): Promise<void> {
    await this.loadPolicies(env.cedar.policiesDir)
  }

  async loadPolicies(dir?: string): Promise<void> {
    dir ??= env.cedar.policiesDir
    const schemaPath = path.join(dir, 'schema.json')

    if (!fs.existsSync(schemaPath)) {
      this.logger.warn(`Cedar schema not found at ${schemaPath} — Cedar authorization disabled (default deny)`)
      return
    }

    this.schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as Record<string, unknown>

    const cedarFiles = fs
      .readdirSync(dir)
      .filter(f => f.endsWith('.cedar'))
      .map(f => path.join(dir, f))

    if (cedarFiles.length === 0) {
      this.logger.warn(`No .cedar policy files found in ${dir} — all requests will be denied`)
      this.policyText = ''
      this.loaded = true
      return
    }

    const parts: string[] = []
    for (const file of cedarFiles) {
      parts.push(fs.readFileSync(file, 'utf8'))
      this.logger.log(`Loaded Cedar policy: ${path.basename(file)}`)
    }
    this.policyText = parts.join('\n\n')

    // Validate policies against schema
    const { validate } = await import('@cedar-policy/cedar-wasm/nodejs')
    const result = validate({ schema: this.schema as never, policies: { staticPolicies: this.policyText } })

    if (result.type === 'failure') {
      for (const err of result.errors) {
        this.logger.error(`Cedar validation error: ${err.message}`)
      }
      this.logger.error('Cedar policy validation failed — Cedar authorization disabled (default deny)')
      return
    }

    for (const err of result.validationErrors ?? []) {
      this.logger.warn(`Cedar policy validation warning in ${err.policyId}: ${err.error.message}`)
    }

    this.loaded = true
    this.logger.log(`Cedar policies loaded and validated (${cedarFiles.length} file(s))`)
  }

  async isAuthorized(
    token: CognitoTokenPayload,
    endpoint: RequestedEndpoint,
    ipAddress: string,
  ): Promise<AuthorizationResult> {
    if (!this.loaded || !this.policyText) {
      return { allowed: false, determiningPolicies: [], reason: 'no policies loaded' }
    }

    const action = HTTP_METHOD_TO_ACTION[endpoint.method.toUpperCase()]
    if (!action) {
      return { allowed: false, determiningPolicies: [], reason: `unknown HTTP method: ${endpoint.method}` }
    }

    const entities = buildEntities(token, endpoint)
    const context  = buildContext(token, endpoint, ipAddress)
    const operationId = endpoint.operationId ?? `${endpoint.method.toUpperCase()}:${endpoint.path}`

    const { isAuthorized } = await import('@cedar-policy/cedar-wasm/nodejs')

    const answer = isAuthorized({
      principal:       { type: 'AegisNamespace::User', id: token.sub },
      action:          { type: 'AegisNamespace::Action', id: action },
      resource:        { type: 'AegisNamespace::ApiEndpoint', id: operationId },
      context,
      policies:        { staticPolicies: this.policyText },
      entities,
      schema:          this.schema as never,
      validateRequest: true,
    })

    if (answer.type === 'failure') {
      const msg = answer.errors.map(e => e.message).join('; ')
      this.logger.warn(`Cedar evaluation error for ${endpoint.method} ${endpoint.path}: ${msg}`)
      return { allowed: false, determiningPolicies: [], reason: msg }
    }

    const { decision, diagnostics } = answer.response
    const allowed = decision === 'allow'

    if (!allowed) {
      this.logger.debug(
        `Cedar DENY ${endpoint.method} ${endpoint.host}${endpoint.path} for sub=${token.sub}`,
      )
    }

    return {
      allowed,
      determiningPolicies: diagnostics.reason,
      reason: allowed ? undefined : 'no matching permit policy',
    }
  }
}
