import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { PlatformJwtGuard } from '../auth/platform-jwt.guard'
import { QueueService } from '../queue/queue.service'
import type { QueueJobState } from '../queue/queue-store'
import type { CloudProxyRequestDto } from './dto/cloud-proxy-request.dto'
import { CloudProxyResponseDto } from './dto/cloud-proxy-response.dto'
import { ProxyService } from './proxy.service'

type EnqueueBody = { request: CloudProxyRequestDto; tenantId: string; userId: string }

@ApiTags('cloud-relay')
@Controller('cloud-relay')
export class CloudRelayController {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly queueService: QueueService,
  ) {}

  // ── Direct mode ────────────────────────────────────────────────────────────

  @Post('proxy')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: 'x-tenant-id', required: true, description: 'Tenant UUID' })
  @ApiHeader({ name: 'x-user-id', required: true, description: 'User UUID' })
  @ApiOperation({ summary: 'Proxy an HTTP request (direct mode)' })
  @ApiResponse({ status: 200, type: CloudProxyResponseDto })
  async proxy(
    @Body() dto: CloudProxyRequestDto,
    @Headers('x-user-id') userId = 'anonymous',
    @Headers('x-tenant-id') tenantId = 'default',
  ): Promise<CloudProxyResponseDto> {
    return this.proxyService.proxy(dto, userId, tenantId)
  }

  // ── Async queue mode ───────────────────────────────────────────────────────

  @Post('queue')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PlatformJwtGuard)
  @ApiHeader({ name: 'authorization', required: true, description: 'Bearer <platform-jwt>' })
  @ApiOperation({
    summary: 'Enqueue an async proxy job (called by derrops-cloud)',
    description:
      'derrops-cloud submits a job here instead of waiting for a direct proxy response. ' +
      'The relay processes it via its internal queue and stores the result. ' +
      'Poll GET /cloud-relay/job/:id for completion.',
  })
  @ApiResponse({
    status: 201,
    schema: { type: 'object', properties: { jobId: { type: 'string' } } },
  })
  @ApiResponse({ status: 401 })
  async enqueue(@Body() body: EnqueueBody): Promise<{ jobId: string }> {
    return this.queueService.enqueue(body.request, body.tenantId, body.userId)
  }

  @Get('job/:id')
  @UseGuards(PlatformJwtGuard)
  @ApiHeader({ name: 'authorization', required: true, description: 'Bearer <platform-jwt>' })
  @ApiOperation({
    summary: 'Get the status and result of a queued job (called by derrops-cloud)',
  })
  @ApiParam({ name: 'id', description: 'Job ID returned by POST /cloud-relay/queue' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 404 })
  async getJob(@Param('id') id: string): Promise<QueueJobState> {
    const job = await this.queueService.getJob(id)
    if (!job) throw new NotFoundException(`Job ${id} not found or expired`)
    return job
  }
}
