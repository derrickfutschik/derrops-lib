import { describe, it } from '@jest/globals'
import { TEST_API_SPECS } from '../../../../test-resources/loader'
import { loadSpecSync } from '../../../derrops-private/src/openapi/openapi-parser'
import { zipOperations } from '../../../derrops-private/src/openapi/openapi-spec-zipper'

// import { har } from './s3.fixture';

/**
 * This is a full end to end to end test of an AWS DynamoDB request being made, and an Derrops Log being created.
 *
 * Limitations:
 *  1. It will not feature API Matching, as this is not yet built.
 *  2. It will also not save the log to a database just yet.
 *
 */
describe('AWS S3', () => {
  it('AWS Operations', async () => {
    const spec = loadSpecSync(TEST_API_SPECS.awsS3())

    const operations = zipOperations(spec)

    const request = {
      method: 'GET',
      path: '/Foo/Bar/#uploadId',
    }

    console.log(request.path.split('/'))

    const possibleMatches = operations.filter(
      (operation) =>
        operation.seg === request.path.split('/').filter((segment) => segment !== '').length,
    )

    console.log(possibleMatches)
  })
})
