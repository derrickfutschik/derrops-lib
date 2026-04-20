import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { IsBoolean, IsObject, IsOptional } from 'class-validator'
import {
  ApiHeader,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { VendorJwtService } from '../vendor-jwt/vendor-jwt.service'
import { CurrentUser } from '../auth/current-user.decorator'
import { CloudRelayService } from './cloud-relay.service'
import { CreateCloudRelayConnectionDto } from './dto/create-cloud-relay-connection.dto'
import { CreateCloudRelayConnectionResponseDto } from './dto/create-cloud-relay-connection-response.dto'
import { UpdateCloudRelayConnectionDto } from './dto/update-cloud-relay-connection.dto'
import { CreateCloudRelayJobDto } from './dto/create-cloud-relay-job.dto'
import { CloudRelayConnection } from './entities/cloud-relay-connection.entity'
import { CloudRelayJob } from './entities/cloud-relay-job.entity'
import { RelayConnectionGuard } from './relay-connection.guard'
import { CurrentConnection } from './current-connection.decorator'
import { User } from '../user/user.dto'

/** Body posted by the relay when delivering a platform-queue job result. */
class DeliverJobResultDto {
  @IsObject()
  result: object

  @IsBoolean()
  @IsOptional()
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
  @ApiOperation({
    summary: 'Vendor JWKS endpoint (used by relays and Aegis to validate platform JWTs)',
  })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', properties: { keys: { type: 'array', items: { type: 'object' } } } },
  })
  getJwks(): { keys: object[] } {
    return this.vendorJwt.getJwks()
  }

  // ── Connection management ─────────────────────────────────────────────────

  @Get('connection')
  @ApiBearerAuth()
  @ApiOperation({ summary: "List relay connections for the authenticated user's tenant" })
  @ApiResponse({ status: 200, type: [CloudRelayConnection] })
  findAllConnections(@CurrentUser() user: User): Promise<CloudRelayConnection[]> {
    return this.cloudRelayService.findAllConnections(user['custom:tenant_id'])
  }

  @Post('connection')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Register a new relay connection',
    description:
      'Creates a relay connection. For platform-queue and hybrid delivery modes, an SQS FIFO queue ' +
      'is provisioned automatically (sqs_queue_mode=platform) or the customer-provided queue URL is stored.\n\n' +
      'The response includes one-time credentials (IAM access key, Aegis registration token) ' +
      'that are never returned again.\n\n' +
      'tenantId and userId are read from the verified Cognito id_token — no client-supplied headers are trusted.',
  })
  @ApiResponse({ status: 201, type: CreateCloudRelayConnectionResponseDto })
  createConnection(
    @Body() dto: CreateCloudRelayConnectionDto,
    @CurrentUser() user: User,
  ): Promise<CreateCloudRelayConnectionResponseDto> {
    return this.cloudRelayService.createConnection(dto, user['custom:tenant_id'], user.sub)
  }

  @Patch('connection/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a relay connection (name, URL, linked Aegis)' })
  @ApiParam({ name: 'id', description: 'Connection UUID' })
  @ApiResponse({ status: 200, type: CloudRelayConnection })
  @ApiResponse({ status: 404 })
  updateConnection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCloudRelayConnectionDto,
    @CurrentUser() user: User,
  ): Promise<CloudRelayConnection> {
    return this.cloudRelayService.updateConnection(id, dto, user['custom:tenant_id'])
  }

  @Delete('connection/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a relay connection, its SQS queue, and IAM user (if any)' })
  @ApiParam({ name: 'id', description: 'Connection UUID' })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  @ApiResponse({ status: 404 })
  async deleteConnection(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<{ message: string }> {
    await this.cloudRelayService.removeConnection(id, user['custom:tenant_id'])
    return { message: 'Cloud relay connection deleted successfully' }
  }

  @Post('connection/:id/health-check')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Test HTTP reachability for a direct or hybrid relay connection',
    description: 'Makes an authenticated GET to <relay-url>/health and returns latency or error.',
  })
  @ApiParam({ name: 'id', description: 'Connection UUID' })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        reachable: { type: 'boolean' },
        latencyMs: { type: 'number' },
        error: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404 })
  healthCheckConnection(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<{ reachable: boolean; latencyMs?: number; error?: string }> {
    return this.cloudRelayService.healthCheckConnection(id, user['custom:tenant_id'])
  }

  @Post('connection/:id/test-queue')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Test SQS queue connectivity for a platform-queue or hybrid relay connection',
    description:
      "Sends a canary message to the connection's SQS queue and verifies the send succeeds. " +
      'Validates that the platform role has sqs:SendMessage permission on the queue.',
  })
  @ApiParam({ name: 'id', description: 'Connection UUID' })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        sent: { type: 'boolean' },
        error: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404 })
  testQueueConnection(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<{ sent: boolean; error?: string }> {
    return this.cloudRelayService.testQueueConnection(id, user['custom:tenant_id'])
  }

  // ── Job submission ────────────────────────────────────────────────────────

  @Post('job')
  @HttpCode(HttpStatus.CREATED)
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
    @CurrentUser() user: User,
  ): Promise<CloudRelayJob> {
    try {
      return await this.cloudRelayService.enqueueJob(dto, user['custom:tenant_id'], user.sub)
    } catch (err) {
      if (err instanceof Error && err.message.includes('mode')) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
  }

  @Get('job/:id')
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
    @CurrentUser() user: User,
  ): Promise<CloudRelayJob> {
    return this.cloudRelayService.getJob(id, user['custom:tenant_id'])
  }

  // ── Platform-queue: relay outbound polling ────────────────────────────────
  // These endpoints are authenticated by the relay's connection api_key (Bearer),
  // not by a Cognito token — the relay process does not have a user session.

  @Get('queue/next')
  @UseGuards(RelayConnectionGuard)
  @ApiHeader({ name: 'authorization', required: true, description: 'Bearer <connection api_key>' })
  @ApiOperation({
    summary: 'Claim the next pending platform-queue job (called by the relay)',
    description:
      'The relay polls this endpoint to claim jobs for legacy HTTP-polling connections. ' +
      'SQS-enabled relays (local-dev) receive jobs via SQS long-poll instead. ' +
      'Authenticate with the connection api_key as a Bearer token.',
  })
  @ApiResponse({
    status: 200,
    type: CloudRelayJob,
    description: 'Job claimed — execute and POST result to /cloud-relay/job/:id/result',
  })
  @ApiResponse({ status: 204, description: 'No pending jobs' })
  @ApiResponse({ status: 401, description: 'Invalid api_key' })
  claimNextJob(
    @CurrentConnection() connection: CloudRelayConnection,
  ): Promise<CloudRelayJob | null> {
    return this.cloudRelayService.claimNextJob(connection)
  }

  @Post('job/:id/result')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RelayConnectionGuard)
  @ApiHeader({ name: 'authorization', required: true, description: 'Bearer <connection api_key>' })
  @ApiOperation({
    summary: 'Deliver the result of a platform-queue job (called by the relay)',
    description:
      'After executing a claimed job, the relay posts the result here. ' +
      'Set `failed: true` to mark the job as failed.',
  })
  @ApiParam({
    name: 'id',
    description: 'Job UUID (from GET /cloud-relay/queue/next or SQS message body)',
  })
  @ApiResponse({ status: 200, type: CloudRelayJob })
  @ApiResponse({ status: 401, description: 'Invalid api_key' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  deliverJobResult(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DeliverJobResultDto,
    @CurrentConnection() connection: CloudRelayConnection,
  ): Promise<CloudRelayJob> {
    return this.cloudRelayService.completeJob(id, connection, body.result, body.failed ?? false)
  }
}
