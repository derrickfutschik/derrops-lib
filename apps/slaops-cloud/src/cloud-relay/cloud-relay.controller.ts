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
  UseGuards,
} from '@nestjs/common'
import { ApiHeader, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { VendorJwtService } from '../vendor-jwt/vendor-jwt.service'
import { CognitoGuard } from '../auth/cognito.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import type { CognitoClaims } from '../auth/cognito.guard'
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

  // ── Connection management ─────────────────────────────────────────────────

  @Get('connection')
  @UseGuards(CognitoGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List relay connections for the authenticated user\'s tenant' })
  @ApiResponse({ status: 200, type: [CloudRelayConnection] })
  findAllConnections(@CurrentUser() user: CognitoClaims): Promise<CloudRelayConnection[]> {
    return this.cloudRelayService.findAllConnections(user.tenantId)
  }

  @Post('connection')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(CognitoGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Register a new relay connection',
    description:
      'For local-dev relays (type=local-dev), a dedicated SQS FIFO queue is provisioned automatically. ' +
      'The response includes sqs_queue_url and sqs_region.\n\n' +
      'tenantId and userId are read from the verified Cognito id_token — no client-supplied headers are trusted.',
  })
  @ApiResponse({ status: 201, type: CloudRelayConnection })
  createConnection(
    @Body() dto: CreateCloudRelayConnectionDto,
    @CurrentUser() user: CognitoClaims,
  ): Promise<CloudRelayConnection> {
    return this.cloudRelayService.createConnection(dto, user.tenantId, user.sub)
  }

  @Delete('connection/:id')
  @UseGuards(CognitoGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a relay connection and its SQS queue (if any)' })
  @ApiParam({ name: 'id', description: 'Connection UUID' })
  @ApiResponse({ status: 200, schema: { type: 'object', properties: { message: { type: 'string' } } } })
  @ApiResponse({ status: 404 })
  async deleteConnection(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CognitoClaims,
  ): Promise<{ message: string }> {
    await this.cloudRelayService.removeConnection(id, user.tenantId)
    return { message: 'Cloud relay connection deleted successfully' }
  }

  // ── Job submission ────────────────────────────────────────────────────────

  @Post('job')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(CognitoGuard)
  @ApiBearerAuth()
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
    @CurrentUser() user: CognitoClaims,
  ): Promise<CloudRelayJob> {
    try {
      return await this.cloudRelayService.enqueueJob(dto, user.tenantId, user.sub)
    } catch (err) {
      if (err instanceof Error && err.message.includes('mode')) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  @Get('job/:id')
  @UseGuards(CognitoGuard)
  @ApiBearerAuth()
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
    @CurrentUser() user: CognitoClaims,
  ): Promise<CloudRelayJob> {
    return this.cloudRelayService.getJob(id, user.tenantId)
  }

  // ── Platform-queue: relay outbound polling ────────────────────────────────
  // These endpoints are authenticated by the relay's connection api_key (Bearer),
  // not by a Cognito token — the relay process does not have a user session.

  @Get('queue/next')
  @ApiHeader({ name: 'authorization', required: true, description: 'Bearer <connection api_key>' })
  @ApiOperation({
    summary: 'Claim the next pending platform-queue job (called by the relay)',
    description:
      'The relay polls this endpoint to claim jobs for legacy HTTP-polling connections. ' +
      'SQS-enabled relays (local-dev) receive jobs via SQS long-poll instead. ' +
      'Authenticate with the connection api_key as a Bearer token.',
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
  @ApiParam({ name: 'id', description: 'Job UUID (from GET /cloud-relay/queue/next or SQS message body)' })
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
