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
platformConvention.name({ type: 's3Bucket', service: 'oaspec', key: 'storage', tenant: tenantId })
// → 'ap-southeast-2--dev--slaops--{tenantId}--oaspec--storage'
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

### Static mode — explicit resource declarations

Use when you are building a policy for a known, fixed set of resources (e.g. a Lambda execution
role, a CDK-defined IAM policy construct).

```typescript
const executionPolicy = dbConvention.staticPolicy()
  .include('dynamoDb', { key: 'sessions' }, { permissions: 'readWrite' })
  .include('ssmParam', { key: 'db-password' }, { permissions: 'read' })
  .include('s3Bucket', { key: 'artefacts' }, { permissions: 'read' })
  .buildPolicy()
// → standard AWS IAM JSON policy document
```

### Dynamic mode — session-recorded policies

Use when you are naming resources in a loop or factory and want the policy to mirror exactly
what was named — no parallel maintenance of a separate list.

```typescript
const session = svcConvention.dynamicPolicy()

const tableName = session.name({ type: 'dynamoDb', key: 'orders' }, { permissions: 'readWrite' })
const paramName = session.name({ type: 'ssmParam', key: 'api-key' }, { permissions: 'read' })
// ... other naming calls — only the types that have ARN metadata are recorded

const policy = session.buildPolicy()
```

### Permission tiers

| Tier        | Use for                                       |
| ----------- | --------------------------------------------- |
| `read`      | Read-only — `Get*`, `List*`, `Describe*`       |
| `readWrite` | Mutating workloads — adds `Put*`, `Delete*`, etc. |
| `manage`    | Administrative — `<service>:*`                |

Prefer the named tier over a manual `actionsFor` list. Use `actionsFor` only when the built-in
tiers do not fit (e.g. a custom action subset for a tightly-scoped role).

### Decision — static vs dynamic

```
Writing an IAM policy?
  ├─ Resources are fixed and known at CDK/infra definition time?
  │   └─ Yes → .staticPolicy().include(type, options, { permissions })
  └─ Resources are produced by a naming loop or factory?
      └─ Yes → .dynamicPolicy() — pass the session where names are generated
```

### Rules

- Never call `new iam.PolicyStatement({ resources: ['arn:aws:s3:::...'] })` with a literal ARN.
- Never pass a raw action string like `'s3:GetObject'` outside of `actionsFor` — use a permission tier.
- The convention instance used for `.staticPolicy()` / `.dynamicPolicy()` must be the same instance
  (or a `.with()` derivative) used to generate the resource names — this is the only guarantee
  that ARNs match names.
- `accountId` must be set via `.arnContext()` before calling `.staticPolicy()` or `.dynamicPolicy()`.
  Keep it in the org-level instance in `lib/names.ts` or `slaops-config`; do not pass it at each call site.

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
8. For IAM policies, use `.staticPolicy()` or `.dynamicPolicy()` on the same convention instance — never write ARNs or action lists as strings.
