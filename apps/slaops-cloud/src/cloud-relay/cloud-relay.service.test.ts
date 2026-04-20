import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { CloudRelayService } from './cloud-relay.service'
import { CloudRelayConnection } from './entities/cloud-relay-connection.entity'
import { CloudRelayJob } from './entities/cloud-relay-job.entity'
import { RelayQueueService } from './relay-queue.service'

const TENANT_ID = 'tenant-1'
const USER_ID = 'user-abc'
const MOCK_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456/slaops-relay.fifo'
const MOCK_REGION = 'us-east-1'

function makeConnectionRepo() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((dto) => ({ ...dto })),
    save: jest.fn((entity) => Promise.resolve({ id: 'generated-id', ...entity })),
    delete: jest.fn(),
  }
}

function makeJobRepo() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((dto) => ({ ...dto })),
    save: jest.fn((entity) => Promise.resolve({ id: 'job-id', ...entity })),
    manager: { transaction: jest.fn() },
  }
}

function makeRelayQueue() {
  return {
    resolveRelayQueue: jest.fn().mockResolvedValue(MOCK_QUEUE_URL),
    getRegion: jest.fn().mockReturnValue(MOCK_REGION),
    publishJob: jest.fn().mockResolvedValue(undefined),
    deleteRelayQueue: jest.fn().mockResolvedValue(undefined),
  }
}

describe('CloudRelayService.createConnection', () => {
  let service: CloudRelayService
  let connectionRepo: ReturnType<typeof makeConnectionRepo>
  let relayQueue: ReturnType<typeof makeRelayQueue>

  beforeEach(async () => {
    connectionRepo = makeConnectionRepo()
    const jobRepo = makeJobRepo()
    relayQueue = makeRelayQueue()

    const moduleRef = await Test.createTestingModule({
      providers: [
        CloudRelayService,
        { provide: getRepositoryToken(CloudRelayConnection), useValue: connectionRepo },
        { provide: getRepositoryToken(CloudRelayJob), useValue: jobRepo },
        { provide: RelayQueueService, useValue: relayQueue },
      ],
    }).compile()

    service = moduleRef.get(CloudRelayService)
  })

  describe('managed type (default)', () => {
    it('creates connection with direct delivery_mode and no SQS fields', async () => {
      const result = await service.createConnection(
        {
          type: 'managed',
          name: 'my-relay',
          url: 'https://relay.example.com',
          delivery_mode: 'direct',
        },
        TENANT_ID,
        USER_ID,
      )

      expect(result).toMatchObject({
        tenant_id: TENANT_ID,
        type: 'managed',
        name: 'my-relay',
        url: 'https://relay.example.com',
        delivery_mode: 'direct',
        sqs_queue_mode: null,
        sqs_queue_url: null,
        sqs_region: null,
        api_key: expect.any(String),
      })
      expect(relayQueue.resolveRelayQueue).not.toHaveBeenCalled()
    })

    it('defaults type to managed and delivery_mode to direct when not supplied', async () => {
      const result = await service.createConnection({}, TENANT_ID, USER_ID)

      expect(result).toMatchObject({
        type: 'managed',
        delivery_mode: 'direct',
      })
    })

    it('auto-generates name when not supplied', async () => {
      const result = await service.createConnection({}, TENANT_ID, USER_ID)

      expect(result.name).toMatch(/^relay-/)
    })

    it('generates a unique api_key per connection', async () => {
      connectionRepo.save
        .mockResolvedValueOnce({ id: 'id-1', api_key: 'key-1' })
        .mockResolvedValueOnce({ id: 'id-2', api_key: 'key-2' })

      const [a, b] = await Promise.all([
        service.createConnection({}, TENANT_ID, USER_ID),
        service.createConnection({}, TENANT_ID, USER_ID),
      ])

      expect(a.api_key).not.toBe(b.api_key)
    })
  })

  describe('local-dev type', () => {
    it('forces delivery_mode to platform-queue regardless of dto value', async () => {
      const result = await service.createConnection(
        { type: 'local-dev', delivery_mode: 'direct' },
        TENANT_ID,
        USER_ID,
      )

      expect(result.delivery_mode).toBe('platform-queue')
    })

    it('calls resolveRelayQueue with platform mode and stores returned queue URL and region', async () => {
      const result = await service.createConnection({ type: 'local-dev' }, TENANT_ID, USER_ID)

      expect(relayQueue.resolveRelayQueue).toHaveBeenCalledWith(
        'platform',
        TENANT_ID,
        USER_ID,
        expect.any(String), // relayId
        undefined,
      )
      expect(result).toMatchObject({
        type: 'local-dev',
        delivery_mode: 'platform-queue',
        sqs_queue_mode: 'platform',
        sqs_queue_url: MOCK_QUEUE_URL,
        sqs_region: MOCK_REGION,
      })
    })

    it('passes relay sqs_queue_mode and customer URL to resolveRelayQueue', async () => {
      const customerUrl = 'https://sqs.us-east-1.amazonaws.com/999/customer-relay.fifo'
      relayQueue.resolveRelayQueue.mockResolvedValue(customerUrl)

      const result = await service.createConnection(
        {
          type: 'local-dev',
          sqs_queue_mode: 'relay',
          relay_sqs_queue_url: customerUrl,
        },
        TENANT_ID,
        USER_ID,
      )

      expect(relayQueue.resolveRelayQueue).toHaveBeenCalledWith(
        'relay',
        TENANT_ID,
        USER_ID,
        expect.any(String),
        customerUrl,
      )
      expect(result).toMatchObject({
        sqs_queue_mode: 'relay',
        sqs_queue_url: customerUrl,
      })
    })

    it('auto-generates name prefixed with local-dev when not supplied', async () => {
      const result = await service.createConnection({ type: 'local-dev' }, TENANT_ID, USER_ID)

      expect(result.name).toMatch(/^local-dev-/)
    })

    it('uses provided name over auto-generated name', async () => {
      const result = await service.createConnection(
        { type: 'local-dev', name: 'my-dev-relay' },
        TENANT_ID,
        USER_ID,
      )

      expect(result.name).toBe('my-dev-relay')
    })

    it('defaults url to http://localhost for local-dev', async () => {
      const result = await service.createConnection({ type: 'local-dev' }, TENANT_ID, USER_ID)

      expect(result.url).toBe('http://localhost')
    })
  })

  describe('self-hosted type', () => {
    it('creates connection with provided delivery_mode and no SQS fields', async () => {
      const result = await service.createConnection(
        {
          type: 'self-hosted',
          name: 'on-prem',
          url: 'https://relay.corp.internal',
          delivery_mode: 'relay-queue',
        },
        TENANT_ID,
        USER_ID,
      )

      expect(result).toMatchObject({
        type: 'self-hosted',
        delivery_mode: 'relay-queue',
        sqs_queue_mode: null,
        sqs_queue_url: null,
        sqs_region: null,
      })
      expect(relayQueue.resolveRelayQueue).not.toHaveBeenCalled()
    })
  })
})
