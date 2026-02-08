import {
  ensureOperationIds,
  getHttpMethodOperations,
  loadSpecSync,
  toCamelCase,
} from '../../src/openapi/openapi-parser'

import { TEST_API_SPECS } from '../../../../test-resources/loader'
import { OPERATION_WITH_NO_ID } from './openapi-spec-zipper.fixture'

describe('OpenAPIParser', () => {
  test('should ensureOperationIds is populating all operations with an operationId', async () => {
    const spec = ensureOperationIds(OPERATION_WITH_NO_ID)
    Object.entries(spec.paths!)
      .filter(([, path]) => path !== undefined && path !== null)
      .map(([, path]) => path!)
      .flatMap((path) => getHttpMethodOperations(path))
      .forEach(([, operation]) => expect(operation.operationId).toBeDefined())
  })
})

test('should loadSpecSync', () => {
  const spec = loadSpecSync(TEST_API_SPECS.awsS3())
  expect(spec).toBeDefined()
})

describe('toCamelCase', () => {
  // Test fixture: array of [input, expected output, description]
  const testCases: Array<[string, string, string]> = [
    // Underscore-separated strings
    ['hello_world', 'helloWorld', 'underscore-separated'],
    ['get_users', 'getUsers', 'underscore-separated'],
    ['post_user_profile', 'postUserProfile', 'underscore-separated'],

    // Hyphen-separated strings
    ['hello-world', 'helloWorld', 'hyphen-separated'],
    ['get-users', 'getUsers', 'hyphen-separated'],
    ['api-key-value', 'apiKeyValue', 'hyphen-separated'],

    // Space-separated strings
    ['hello world', 'helloWorld', 'space-separated'],
    ['get users', 'getUsers', 'space-separated'],
    ['api key value', 'apiKeyValue', 'space-separated'],

    // Mixed separators
    ['hello_world-test', 'helloWorldTest', 'mixed separators'],
    ['get users_profile', 'getUsersProfile', 'mixed separators'],
    ['api_key-value test', 'apiKeyValueTest', 'mixed separators'],

    // Single word
    ['hello', 'hello', 'single word lowercase'],
    ['HELLO', 'hello', 'single word uppercase'],
    ['Hello', 'hello', 'single word capitalized'],

    // Uppercase input
    ['HELLO_WORLD', 'helloWorld', 'uppercase with underscores'],
    ['GET_USERS', 'getUsers', 'uppercase with underscores'],
    ['API_KEY_VALUE', 'apiKeyValue', 'uppercase with underscores'],

    // Mixed case input
    ['Hello_World', 'helloWorld', 'mixed case with underscores'],
    ['Get_Users', 'getUsers', 'mixed case with underscores'],
    ['API_Key_Value', 'apiKeyValue', 'mixed case with underscores'],

    // Multiple consecutive separators
    ['hello___world', 'helloWorld', 'multiple underscores'],
    ['hello---world', 'helloWorld', 'multiple hyphens'],
    ['hello   world', 'helloWorld', 'multiple spaces'],
    ['hello_-_world', 'helloWorld', 'mixed consecutive separators'],

    // Strings with numbers
    ['user_123', 'user123', 'with numbers'],
    ['api_v2', 'apiV2', 'with version number'],
    ['test_1_2_3', 'test123', 'multiple numbers'],

    // Edge cases
    ['', '', 'empty string'],
    ['___', '', 'only underscores'],
    ['---', '', 'only hyphens'],
    ['   ', '', 'only spaces'],

    // Real-world operationId examples
    ['delete_users_id', 'deleteUsersId', 'real-world: delete endpoint'],
    ['get_users_id_posts', 'getUsersIdPosts', 'real-world: nested resource'],
  ]

  test.each(testCases)("should convert '%s' to '%s' (%s)", (input, expected, description) => {
    expect(toCamelCase(input)).toBe(expected)
  })
})
