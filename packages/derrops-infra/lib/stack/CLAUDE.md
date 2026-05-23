# lib/stack — CDK stacks

Each file is a CDK stack that extends `DerropsStack`. The convention instance is passed in at the call site (`bin/cdk.ts`) and flows through to every resource name inside the stack.

## Base class — `DerropsStack`

```typescript
export abstract class DerropsStack extends Stack {
  constructor(
    protected conventions: DerropsConventions,
    scope: Construct,
    id: string,
    props?: StackProps,
  ) {
    super(scope, id, { ...props, stackName: conventions.name({ type: 'cloudFormationStack' }) })
    conventions.applyTags((k, v) => this.addStackTag(k, v))
  }

  protected resource = this.conventions.resource
  protected name = this.conventions.name
}
```

- `stackName` is generated from the convention — never pass it manually.
- Tags are applied automatically from the convention segments.
- `this.name()` and `this.resource()` are shorthand for the convention's methods inside a stack.

## Passing a convention at the call site

Set all segments that are fixed for the stack's lifetime in `bin/cdk.ts`. The stack itself only calls `this.name()` / `this.resource()` and optionally overrides per-resource segments.

```typescript
// bin/cdk.ts
const userpoolStack = new UserPoolStack(
  config.convention.with({ domain: 'user-management', key: 'userpool' }),
  app,
  'DerropsUserPoolStack',
  { description: 'Derrops User Pool Stack', env },
)
```

The CDK Stack ID (`'DerropsUserPoolStack'`) is used by the CDK CLI (e.g. `cdk diff DerropsUserPoolStack`). The CloudFormation stack name is derived from the convention.

## Naming resources inside a stack

Use `this.name()` for the AWS resource name property and `this.resource()` when you also need the ARN for an IAM policy. The convention already has `domain` and `service` (or `key`) set — add a `purpose` or `kind` to distinguish resources within the stack.

From `userpool.ts`:

```typescript
// User Pool — no extra segments needed, one per convention scope
this.userPool = new cognito.UserPool(this, 'DerropsUserPool', {
  userPoolName: this.name({ type: 'cognitoUserPool' }),
})

// IAM roles — use 'purpose' to distinguish roles within the same stack
this.sqsPublishRole = new iam.Role(this, 'SqsPublishRole', {
  roleName: this.name({ type: 'iamRole', purpose: 'sqs-publish' }),
})

const authenticatedRole = new iam.Role(this, 'IdentityPoolAuthenticatedRole', {
  roleName: this.name({ type: 'iamRole', purpose: 'authenticated' }),
})
```

**Segment guidance:**

| Segment   | When to use                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| _(none)_  | One resource of this type in the stack — the convention scope is already specific enough                             |
| `purpose` | Multiple resources of the same type with different intents — `sqs-publish`, `authenticated`, `dlq-retry`             |
| `kind`    | Multiple resources of the same type with different structural categories — `http`, `stream`, `private`, `public`     |
| `key`     | Sub-resource of a named entity — prefer setting this on the convention passed from `bin/cdk.ts` rather than per-call |

## Creating a new stack

1. Create `lib/stack/<name>.ts` extending `DerropsStack`:

```typescript
import { StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { DerropsStack } from './derrops-stack'
import { DerropsConventions } from '@derrops-conventions'

export class MyStack extends DerropsStack {
  constructor(conventions: DerropsConventions, scope: Construct, id: string, props?: StackProps) {
    super(conventions, scope, id, props)

    // Resources use this.name() / this.resource() — no hardcoded strings
  }
}
```

2. Register it in `bin/cdk.ts`, setting the convention segments appropriate for the stack:

```typescript
new MyStack(
  config.convention.with({ domain: 'platform', service: 'my-service' }),
  app,
  'DerropsMyStack',
  { description: '...', env },
)
```

3. If the stack depends on outputs from another stack, declare it:

```typescript
myStack.addDependency(vpcStack)
```

## Companion docs

Each stack has a corresponding `<name>.md` in this directory describing its purpose and containing a Mermaid infrastructure diagram. Keep both in sync when adding or removing resources.
