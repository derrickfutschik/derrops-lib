/**
 * Unit tests for OpenApiParserService
 */
import { Test } from '@nestjs/testing'
import { IndexingErrorCode } from '../openapi-search/types/openapi-index.types'
import { OpenApiParserService } from './openapi-parser.service'

describe('OpenApiParserService', () => {
  let service: OpenApiParserService

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [OpenApiParserService],
    }).compile()

    service = moduleRef.get(OpenApiParserService)
  })

  describe('extractPathComponents', () => {
    it('extracts provider, service, version from S3 key format', () => {
      const s3Key = 'APIs/1password.com/events/1.2.0/openapi.yaml'
      const result = service.extractPathComponents(s3Key)
      expect(result).toEqual({
        provider: '1password.com',
        service: 'events',
        version: '1.2.0',
      })
    })

    it('extracts provider, service, version from full filesystem path', () => {
      const fullPath =
        '/Users/dfutschik/slaops/slaops-platform/test-resources/openapi-directory/APIs/1password.com/events/1.2.0/openapi.yaml'
      const result = service.extractPathComponents(fullPath)
      expect(result).toEqual({
        provider: '1password.com',
        service: 'events',
        version: '1.2.0',
      })
    })

    it('extracts from S3 key with json extension', () => {
      const s3Key = 'APIs/ably.net/control/v1/openapi.json'
      const result = service.extractPathComponents(s3Key)
      expect(result).toEqual({
        provider: 'ably.net',
        service: 'control',
        version: 'v1',
      })
    })

    it('throws for invalid path - missing APIs segment', () => {
      const invalidPath = 'some/other/path/1password.com/events/1.2.0/openapi.yaml'
      expect(() => service.extractPathComponents(invalidPath)).toThrow()
      try {
        service.extractPathComponents(invalidPath)
      } catch (e: any) {
        expect(e.code).toBe(IndexingErrorCode.INVALID_PATH)
      }
    })

    it('throws for path with insufficient segments after APIs', () => {
      const shortPath = 'APIs/1password.com/events/openapi.yaml'
      expect(() => service.extractPathComponents(shortPath)).toThrow()
      try {
        service.extractPathComponents(shortPath)
      } catch (e: any) {
        expect(e.code).toBe(IndexingErrorCode.INVALID_PATH)
      }
    })
  })
})
