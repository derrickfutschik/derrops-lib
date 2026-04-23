# Resource Naming with derrops-conventions

All AWS resource names in this monorepo must be generated via `DerropsConventions` from
`@derrops-conventions`. Never write a resource name as a plain string.

## Where to define a resource name

Define a name **as close to where it's used as possible**. Only elevate it when it needs to
be referenced across package boundaries:

| Scope                                                      | Where to define                                                      |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| Used only within one package (e.g. only in `slaops-infra`) | A constants file in that package (e.g. `lib/names.ts`)               |
| Shared across two or more packages/apps                    | `packages/slaops-config/src/` — add to `config.ts` or a sibling file |
| Runtime-dynamic (varies per tenant/env/request)            | `config.ts` as a function property: `config['key'](tenantId, ...)`   |

Before adding anything to `slaops-config`, ask: is this name actually consumed outside the
package where it's defined? If no, keep it local.

## Decision tree

```
Creating or referencing an AWS resource name?
  ├─ Already defined somewhere in this package?
  │   └─ Yes → use it. Stop here.
  ├─ Already defined in slaops-config (shared)?
  │   └─ Yes → import and use it. Stop here.
  └─ No → is this name needed outside the current package?
       ├─ No  → define it locally (constants file in the same package)
       └─ Yes → add it to packages/slaops-config/src/ and reference via config['key']
```

## Nesting pattern

Regardless of where the constant lives, always construct convention instances via immutable
derivation — one level at a time:

```typescript
// org-level root
const orgConvention = new DerropsConventions({ org: 'slaops', env, region })
  .tagPrefix('slaops:')
  .tagKeys('org', 'domain', 'service')

// domain-level
const platformConvention = orgConvention.with({ domain: 'platform' })
const oaspecConvention = orgConvention.with({ domain: 'oaspec' })

// service-level
const vpcConvention = platformConvention.with({ service: 'vpc' })
const dbConvention = platformConvention.with({ service: 'app-database' })
```

`.with()` is immutable — never mutate a shared instance after sharing it.

## Generating names

```typescript
vpcConvention.name({ type: 'vpc' })
// → 'slaops--platform--vpc'

vpcConvention.name({ type: 'vpc', key: 'id' })
// → 'slaops--platform--vpc--id'   (also correct for CloudFormation export names)

// S3 (global: true — includes region + env automatically)
oaspecConvention.name({ type: 's3Bucket', service: 'storage', tenant: tenantId })
// → 'ap-southeast-2--dev--slaops--oaspec--storage--{tenantId}'
```

Use the `type` that matches the AWS resource. Full list: `DerropsConventions.resourceTypes()` or
`packages/derrops-conventions/src/resource-types.ts`.

## Where `@derrops-conventions` may be imported

Any package that needs to generate names may import `@derrops-conventions` directly — provided
it has the package in its own `dependencies`. There is no rule that names must funnel through
`slaops-config`; the rule is only that names shared across packages must be stored in one
authoritative location (whichever package is the natural owner) and referenced from there.

```typescript
// ✅ OK in slaops-infra if 'slaops-infra' is the only consumer
//   lib/names.ts
import { DerropsConventions } from '@derrops-conventions'

const org = new DerropsConventions({ org: 'slaops' })
const platform = org.with({ domain: 'platform' })

export const NAMES = {
  vpcExportId:  platform.with({ service: 'vpc' }).name({ type: 'vpc', key: 'id' }),
  opensearchEp: platform.with({ service: 'opensearch' }).name({ type: 'openSearchDomain', key: 'endpoint' }),
} as const

// ✅ OK in slaops-config when the name is consumed by both infra and the app
//   packages/slaops-config/src/config.ts  (or a sibling file)
'slaops.oaspec.storage.bucket': orgConvention.with({ domain: 'oaspec' }).name({
  type: 's3Bucket', service: 'storage', tenant: globalTenantId
}),
```

## Referencing names by layer

### App code (NestJS, Lambda handlers, portal)

```typescript
import { config } from '@slaops/config'
const bucket = config['slaops.oaspec.storage.bucket'] // ✅
const bucket = `${region}--${env}--slaops--oaspec--...` // ❌ never inline
```

### CDK infra stacks — locally-scoped names

```typescript
import { NAMES } from '../names'

Fn.importValue(NAMES.vpcExportId) // ✅
new CfnOutput(this, 'VpcId', { exportName: NAMES.vpcExportId }) // ✅

new CfnOutput(this, 'VpcId', { exportName: 'slaops--platform--vpc--id' }) // ❌
```

### CDK infra stacks — cross-package names

```typescript
import { config } from '@slaops/config'
const bucketName = config['slaops.oaspec.storage.bucket'] // ✅
```

## IAM policy generation

Never write an IAM policy ARN or action list as a plain string. IAM policies must be generated
from the same `DerropsConventions` instance used to name the resources — this guarantees the ARNs
in the policy match the names in the stack.

### Setup — store the account ID once

Set `.arnContext({ accountId })` on the org-level convention instance. Region is sourced from
the `region` segment already on the instance.

```typescript
const orgConvention = new DerropsConventions({ org: 'slaops', env, region })
  .arnContext({ accountId })
  .tagPrefix('slaops:')
  .tagKeys('org', 'domain', 'service')
```

`.arnContext()` propagates through `.with()` — derived instances inherit it automatically.

### Preferred — `.resource()` + `PolicyBuilder`

Use `.resource()` to get a first-class resource descriptor (name, ARN, type, tags), then express
permission intent directly on the resource object and compose grants in a `PolicyBuilder`.
Resources with identical action sets are **automatically merged into one statement**.

```typescript
const table = svcConvention.resource({ type: 'dynamoDb', key: 'orders' })
const gsi = svcConvention.resource({ type: 'dynamoDbGsi', key: 'orders' })
const param = svcConvention.resource({ type: 'ssmParam', key: 'db-password' })
const bucket = svcConvention.resource({ type: 's3Bucket', key: 'artefacts' })

const policy = svcConvention
  .policyBuilder()
  .allow(table.write(), gsi.write()) // merged: same DynamoDB actions → 1 statement
  .allow(param.read())
  .allow(bucket.read())
  .build()
// → standard AWS IAM JSON policy document with 3 statements
```

**Permission methods on `Resource`:**

| Method             | Maps to tier | Use for                                     |
| ------------------ | ------------ | ------------------------------------------- |
| `.read()`          | `read`       | Read-only — `Get*`, `List*`, `Describe*`    |
| `.write()`         | `readWrite`  | Read + write — adds `Put*`, `Delete*`, etc. |
| `.manage()`        | `manage`     | Full control — `<service>:*`                |
| `.raw(...actions)` | —            | Explicit action subset or wildcard          |

**Escape hatch for non-ARN resources** (e.g. CloudWatch metrics, which require `Resource: '*'`):

```typescript
import { rawGrant } from '@derrops-conventions'

policy.allow(rawGrant(['cloudwatch:PutMetricData', 'cloudwatch:PutMetricAlarm'], '*'))
```

Use `table.name`, `table.arn`, `table.arns`, `table.tags` wherever you previously used the string
returned by `.name()` — the resource object carries all of that.

### Legacy — static mode

Use only when maintaining existing CDK code that pre-dates `.resource()`.

```typescript
const executionPolicy = dbConvention
  .staticPolicy()
  .include('dynamoDb', { key: 'sessions' }, { permissions: 'readWrite' })
  .include('ssmParam', { key: 'db-password' }, { permissions: 'read' })
  .buildPolicy()
```

### Legacy — dynamic mode

Use only when maintaining existing CDK code that pre-dates `.resource()`.

```typescript
const session = svcConvention.dynamicPolicy()
const tableName = session.name({ type: 'dynamoDb', key: 'orders' }, { permissions: 'readWrite' })
const policy = session.buildPolicy()
```

### Decision tree

```
Writing an IAM policy?
  └─ Default → .resource() + .policyBuilder()
       ├─ Cross-convention resources? → new PolicyBuilder() directly, pass Resource objects from each
       └─ Non-ARN service (CloudWatch metrics etc.)? → rawGrant(['action'], '*')
```

### Rules

- Never call `new iam.PolicyStatement({ resources: ['arn:aws:s3:::...'] })` with a literal ARN.
- Never write an IAM action string directly — use `.read()`, `.write()`, `.manage()`, or `.raw()`.
- The convention instance used for `.resource()` must be the same instance (or a `.with()` derivative)
  used to generate the resource name — this is the only guarantee that ARNs match names.
- `accountId` must be set via `.arnContext()` before calling `.resource()`, `.staticPolicy()`, or `.dynamicPolicy()`.
  Keep it on the org-level instance in `lib/names.ts` or `slaops-config`; do not pass it at each call site.

## Tagging AWS resources

Never call `Tags.of(this).add(key, value)` with a manually typed string. Use
`applyTags()` from the convention instance:

```typescript
// ✅
svcConvention.applyTags((k, v) => Tags.of(this).add(k, v))

// ❌
Tags.of(this).add('slaops:domain', 'platform')
Tags.of(this).add('slaops:service', 'vpc')
```

Configure `tagPrefix` and `tagKeys` once on the org-level instance; they propagate via `.with()`.

## No duplicate definitions

Before creating a new name constant, search the package and `slaops-config` for an existing one.
Never define the same name in two places. If a local constant needs to become cross-package,
move it to `slaops-config` and update all import sites.

## Checklist — before writing any resource name or IAM policy

1. Search the current package for an existing constant.
2. Search `packages/slaops-config/src/` for an existing shared constant.
3. If found, use it. Do not duplicate.
4. If not found, decide: local (package constants file) or shared (`slaops-config`)?
5. Add using the org → domain → service nesting pattern with a JSDoc comment.
6. Reference via the exported constant — never reconstruct the string at a call site.
7. For CDK resources, apply tags via `applyTags((k, v) => Tags.of(this).add(k, v))`.
8. For IAM policies, use `.resource()` + `.policyBuilder()` on the same convention instance — never write ARNs or action lists as strings. Use `.read()`, `.write()`, `.manage()`, or `.raw()` on the resource object to express permission intent.
