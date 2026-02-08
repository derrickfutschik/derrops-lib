import { OpenAPIV3_1 } from 'openapi-types'

export const EMPTY_OPERATION_SPEC: OpenAPIV3_1.Document = {
  openapi: '3.1.0',
  info: { title: 'Empty API', version: '1.0.0' },
  components: {},
}

export const SINGLE_OPERATION_SPEC_GET_USER: OpenAPIV3_1.Document = {
  openapi: '3.1.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/users/{userId}': {
      get: {
        operationId: 'getUser',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'Success',
          },
        },
      },
    },
  },
}

export const LIST_USERS_OPERATION_SPEC: OpenAPIV3_1.Document = {
  openapi: '3.1.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/users': {
      get: {
        operationId: 'listUsers',
        responses: { '200': { description: 'Success' } },
      },
      post: {
        operationId: 'createUser',
        responses: { '201': { description: 'Created' } },
      },
    },
  },
}

export const HEALTH_CHECK_OPERATION_SPEC: OpenAPIV3_1.Document = {
  openapi: '3.1.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/health': {
      get: {
        // No operationId
        responses: { '200': { description: 'Healthy' } },
      },
    },
  },
}

// Spec with direct $ref in request/response
export const OPERATION_WITH_DIRECT_REF: OpenAPIV3_1.Document = {
  openapi: '3.1.0',
  info: { title: 'Test API', version: '1.0.0' },
  components: {
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
        },
      },
      CreateUserRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/users': {
      post: {
        operationId: 'createUser',
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateUserRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
        },
      },
    },
  },
}

// Spec with nested $ref (allOf, oneOf, anyOf)
export const OPERATION_WITH_NESTED_REF: OpenAPIV3_1.Document = {
  openapi: '3.1.0',
  info: { title: 'Test API', version: '1.0.0' },
  components: {
    schemas: {
      BaseEntity: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          createdAt: { type: 'string' },
        },
      },
      User: {
        allOf: [
          { $ref: '#/components/schemas/BaseEntity' },
          {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
            },
          },
        ],
      },
      AdminUser: {
        allOf: [
          { $ref: '#/components/schemas/User' },
          {
            type: 'object',
            properties: {
              role: { type: 'string' },
            },
          },
        ],
      },
    },
  },
  paths: {
    '/admin/users': {
      get: {
        operationId: 'getAdminUser',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AdminUser' },
              },
            },
          },
        },
      },
    },
  },
}

// Spec with array items containing $ref
export const OPERATION_WITH_ARRAY_REF: OpenAPIV3_1.Document = {
  openapi: '3.1.0',
  info: { title: 'Test API', version: '1.0.0' },
  components: {
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
        },
      },
      UserList: {
        type: 'array',
        items: { $ref: '#/components/schemas/User' },
      },
    },
  },
  paths: {
    '/users': {
      get: {
        operationId: 'listUsers',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserList' },
              },
            },
          },
        },
      },
    },
  },
}

// Spec with properties containing $ref
export const OPERATION_WITH_PROPERTY_REF: OpenAPIV3_1.Document = {
  openapi: '3.1.0',
  info: { title: 'Test API', version: '1.0.0' },
  components: {
    schemas: {
      Address: {
        type: 'object',
        properties: {
          street: { type: 'string' },
          city: { type: 'string' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          address: { $ref: '#/components/schemas/Address' },
        },
      },
    },
  },
  paths: {
    '/users/{userId}': {
      get: {
        operationId: 'getUser',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
        },
      },
    },
  },
}

// Spec with circular references
export const OPERATION_WITH_CIRCULAR_REF: OpenAPIV3_1.Document = {
  openapi: '3.1.0',
  info: { title: 'Test API', version: '1.0.0' },
  components: {
    schemas: {
      Node: {
        type: 'object',
        properties: {
          value: { type: 'string' },
          children: {
            type: 'array',
            items: { $ref: '#/components/schemas/Node' },
          },
        },
      },
    },
  },
  paths: {
    '/tree': {
      get: {
        operationId: 'getTree',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Node' },
              },
            },
          },
        },
      },
    },
  },
}

// Spec with parameters containing schema $ref
export const OPERATION_WITH_PARAM_REF: OpenAPIV3_1.Document = {
  openapi: '3.1.0',
  info: { title: 'Test API', version: '1.0.0' },
  components: {
    schemas: {
      UserId: {
        type: 'integer',
        minimum: 1,
      },
    },
  },
  paths: {
    '/users/{userId}': {
      get: {
        operationId: 'getUser',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { $ref: '#/components/schemas/UserId' },
          },
        ],
        responses: {
          '200': { description: 'Success' },
        },
      },
    },
  },
}

export const OPERATION_WITH_NO_ID: OpenAPIV3_1.Document = {
  openapi: '3.1.0',
  info: { title: 'Test API', version: '1.0.0' },
  components: {
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
        },
      },
      CreateUserRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/users': {
      post: {
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateUserRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
        },
      },
    },
    '/users/{userId}': {
      get: {
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
        },
      },
    },
  },
}
