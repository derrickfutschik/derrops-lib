/**
 * Controller for indexing OpenAPI specs (e.g. from request body).
 */

import { BadRequestException, Body, Controller, Post, UsePipes } from '@nestjs/common'
import { OpenAPICreateService } from './openapi-create.service'

@Controller('openapi')
export class OpenApiIndexerController {
  constructor(private readonly openapiCreateService: OpenAPICreateService) {}

  /**
   * Accept an OpenAPI spec as body (string or JSON object), index it into OpenSearch, and return the parsed spec.
   * Supports Content-Type: application/json, text/plain, text/yaml, application/yaml.
   */
  @Post('')
  @UsePipes()
  async indexSpec(
    @Body()
    body: string | Record<string, unknown>,
  ): Promise<unknown> {
    if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
      throw new BadRequestException(
        'Empty request body. Send an OpenAPI spec as JSON or YAML (Content-Type: application/json, text/yaml, or text/plain).',
      )
    }
    const content = typeof body === 'string' ? body : JSON.stringify(body)
    console.log(content)
    return this.openapiCreateService.createSpec(content)
  }
}
