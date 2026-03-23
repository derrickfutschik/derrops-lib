import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { VendorJwtService } from '../vendor-jwt/vendor-jwt.service'
import { CloudRelayService } from './cloud-relay.service'
import { CreateCloudRelayConnectionDto } from './dto/create-cloud-relay-connection.dto'
import { CreateCloudRelayJobDto } from './dto/create-cloud-relay-job.dto'
import { CloudRelayConnection } from './entities/cloud-relay-connection.entity'
import { CloudRelayJob } from './entities/cloud-relay-job.entity'

/** Body posted by the relay when delivering a platform-queue job result. */
class DeliverJobResultDto {
  result: object
  failed?: boolean
}

@ApiTags('Cloud Relay')
@Controller('cloud-relay')
export class CloudRelayController {
  constructor(
    private readonly cloudRelayService: CloudRelayService,
    private readonly vendorJwt: VendorJwtService,
  ) {}

  // ── Vendor JWKS (public, unauthenticated) ─────────────────────────────────

  @Get('.well-known/jwks.json')
  @ApiOperation({ summary: 'Vendor JWKS endpoint (used by relays and Aegis to validate platform JWTs)' })
  @ApiResponse({ status: 200, schema: { type: 'object', properties: { keys: { type: 'array', items: { type: 'object' } } } } })
  getJwks(): { keys: object[] } {
    return this.vendorJwt.getJwks()
  }

  // ── Connection management (portal → slaops-cloud) ─────────────────────────

  @Get('connection')
  @ApiHeader({ name: 'x-tenant-id', required: true })
  @ApiOperation({ summary: 'List relay connections for the tenant' })
  @ApiResponse({ status: 200, type: [CloudRelayConnection] })
  findAllConnections(@Headers('x-tenant-id') tenantId = 'default'): Promise<CloudRelayConnection[]> {
    return this.cloudRelayService.findAllConnections(tenantId)
  }

  @Post('connection')
  @HttpCode(HttpStatus.CREATED)
  @ApiHeader({ name: 'x-tenant-id', required: true })
  @ApiOperation({
    summary: 'Register a new relay connection',
    description:
      'Returns `api_key` — configure the relay with `RELAY_API_KEY=<value>` so slaops-cloud ' +
      'can authenticate when submitting jobs and polling results.',
  })
  @ApiResponse({ status: 201, type: CloudRelayConnection })
  createConnection(
    @Body() dto: CreateCloudRelayConnectionDto,
    @Headers('x-tenant-id') tenantId = 'default',
  ): Promise<CloudRelayConnection> {
    return this.cloudRelayService.createConnection(dto, tenantId)
  }

  @Delete('connection/:id')
  @ApiHeader({ name: 'x-tenant-id', required: true })
  @ApiOperation({ summary: 'Delete a relay connection' })
  @ApiParam({ name: 'id', description: 'Connection UUID' })
  @ApiResponse({ status: 200, schema: { type: 'object', properties: { message: { type: 'string' } } } })
  @ApiResponse({ status: 404 })
  async deleteConnection(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-tenant-id') tenantId = 'default',
  ): Promise<{ message: string }> {
    await this.cloudRelayService.removeConnection(id, tenantId)
    return { message: 'Cloud relay connection deleted successfully' }
  }

  // ── Job submission (portal → slaops-cloud) ────────────────────────────────

  @Post('job')
  @HttpCode(HttpStatus.CREATED)
  @ApiHeader({ name: 'x-tenant-id', required: true })
  @ApiHeader({ name: 'x-user-id', required: true })
  @ApiOperation({
    summary: 'Submit a proxy job',
    description:
      'slaops-cloud routes the request via the connection delivery_mode. ' +
      'direct: result is returned inline (completed immediately). ' +
      'relay-queue/platform-queue: job is pending — poll GET /cloud-relay/job/:id for the result.',
  })
  @ApiResponse({ status: 201, type: CloudRelayJob })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  @ApiResponse({ status: 503, description: 'Relay unreachable (direct/relay-queue modes)' })
  async enqueueJob(
    @Body() dto: CreateCloudRelayJobDto,
    @Headers('x-tenant-id') tenantId = 'default',
    @Headers('x-user-id') userId = 'anonymous',
  ): Promise<CloudRelayJob> {
    try {
      return await this.cloudRelayService.enqueueJob(dto, tenantId, userId)
    } catch (err) {
      if (err instanceof Error && err.message.includes('mode')) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  @Get('job/:id')
  @ApiHeader({ name: 'x-tenant-id', required: true })
  @ApiOperation({
    summary: 'Poll for the result of a proxy job',
    description:
      'For relay-queue mode, slaops-cloud syncs status from the relay on each poll. ' +
      'For platform-queue and direct modes, returns the stored job state.',
  })
  @ApiParam({ name: 'id', description: 'Job UUID returned by POST /cloud-relay/job' })
  @ApiResponse({ status: 200, type: CloudRelayJob })
  @ApiResponse({ status: 404 })
  getJob(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-tenant-id') tenantId = 'default',
  ): Promise<CloudRelayJob> {
    return this.cloudRelayService.getJob(id, tenantId)
  }

  // ── Platform-queue: relay outbound polling ────────────────────────────────

  @Get('queue/next')
  @ApiHeader({ name: 'authorization', required: true, description: 'Bearer <connection api_key>' })
  @ApiOperation({
    summary: 'Claim the next pending platform-queue job (called by the relay)',
    description:
      'The relay polls this endpoint to claim jobs when it cannot accept inbound connections. ' +
      'Authenticate with the connection api_key as a Bearer token. ' +
      'Returns 204 when there is nothing to process.',
  })
  @ApiResponse({ status: 200, type: CloudRelayJob, description: 'Job claimed — execute and POST result to /cloud-relay/job/:id/result' })
  @ApiResponse({ status: 204, description: 'No pending jobs' })
  @ApiResponse({ status: 401, description: 'Invalid api_key' })
  async claimNextJob(
    @Headers('authorization') authorization = '',
  ): Promise<CloudRelayJob | null> {
    const apiKey = authorization.replace(/^Bearer\s+/i, '')
    const connection = await this.cloudRelayService.findConnectionByApiKey(apiKey)
    return this.cloudRelayService.claimNextJob(connection)
  }

  @Post('job/:id/result')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: 'authorization', required: true, description: 'Bearer <connection api_key>' })
  @ApiOperation({
    summary: 'Deliver the result of a platform-queue job (called by the relay)',
    description:
      'After executing a claimed job, the relay posts the result here. ' +
      'Set `failed: true` to mark the job as failed.',
  })
  @ApiParam({ name: 'id', description: 'Job UUID (from GET /cloud-relay/queue/next)' })
  @ApiResponse({ status: 200, type: CloudRelayJob })
  @ApiResponse({ status: 401, description: 'Invalid api_key' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async deliverJobResult(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DeliverJobResultDto,
    @Headers('authorization') authorization = '',
  ): Promise<CloudRelayJob> {
    const apiKey = authorization.replace(/^Bearer\s+/i, '')
    const connection = await this.cloudRelayService.findConnectionByApiKey(apiKey)
    return this.cloudRelayService.completeJob(id, connection, body.result, body.failed ?? false)
  }
}
