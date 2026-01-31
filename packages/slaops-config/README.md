# Configuration & Secrets Ownership Guide

This document defines **where configuration and secrets live**, **why**, and **the rules governing each layer**.  
The goal is to make configuration **explicit, auditable, secure, and predictable**.

---

## Where does configuration live?

Configuration is split into **layers**, each with a **clear responsibility**.  
No single system should answer every question.

---

### .env files

.env files are used to store configuration for the local development environment.
They are not committed to the repository and are ignored by git.
Their main purpose should be to contain secrets that are not committed to the repository.

---

## Git (Policy Layer)

**Git is the source of truth for intent and policy.**

It answers _why_ something exists, not _what it currently is_.

### Answers

- What is allowed?
- Who approved it?
- When did it change?
- Why did it change?
- What constraints apply?

### Examples

- Allowed instance classes
- Allowed regions
- Min / max sizes
- Feature availability by environment
- Compliance and security rules

### Rules

- Git **must** define:
  - allowed values
  - schemas
  - constraints
  - defaults **only at the policy level**
- Git **must not** contain:
  - secrets
  - live endpoints
  - environment-specific runtime values
- All changes require review
- Git changes are **auditable and immutable**

> Git defines _what is permissible_, not _what is currently running_.

---

## SSM Parameter Store (Active Layer)

**SSM represents the current operational state.**

It answers _what is live right now_.

### Answers

- What is the current value?
- What is the current status?
- What features are enabled?
- What configuration is active in this environment?

### Examples

- Feature flags
- Runtime toggles
- Service endpoints
- Timeouts, limits, thresholds
- Environment-specific overrides

### Rules

- Values **must** conform to Git-defined policy
- Changes **must not** require rebuilds
- Values **must be environment-scoped**
- Parameters **must be namespaced and hierarchical**
- Parameters **must be non-secret**

> SSM is the _runtime truth_, not the design authority.

---

## Tags (Metadata Layer)

**Tags answer “who owns this and why does it exist?”**

### Answers

- Who owns this?
- Which system does it belong to?
- What environment is it for?
- What cost centre applies?

### Rules

- All AWS resources **must** be tagged
- Ownership **must** be explicit
- Tags **must not** encode configuration logic
- Tags are **metadata only**, never control flow

---

## Secrets Manager (Secrets Layer)

**Secrets Manager exists only for sensitive material.**

### What belongs here

- Passwords
- Tokens
- API keys
- Certificates
- Private credentials

### Rules

- Must be injected at runtime
- Must not require rebuild
- Must not be hardcoded
- Must not leak via logs, errors, or metrics
- Must not be readable by unauthorised services
- Rotation should be enabled where possible

> If exposure would cause an incident → it is a secret.

---

## Codebase (Consumer Layer)

**The codebase consumes configuration — it does not define it.**

### Codebase can depend on

- Configuration keys
- Schemas
- Allowed ranges
- Environment shapes
- Validation rules

### Codebase must not depend on

- Runtime values
- Secrets
- Live endpoints
- Environment-specific defaults

---

## Opinion: No Defaults in Code

**There should be no runtime defaults in the codebase.**

### Rationale

- Defaults hide missing configuration
- Defaults drift silently over time
- Defaults reduce observability
- Defaults create environment ambiguity

### Exception

Only well defined defaults should be used in the codebase, such as ports for databases (5432 for PostgreSQL, 6379 for Redis, etc.) or other well known values.

### Rule

> If a value is required to run, it **must be explicitly provided** by configuration.

The only acceptable “defaults” are:

- schema-level constraints
- policy-level allowed ranges
- validation rules

---

## Where should configuration live?

| Value type              | Where it lives      |
| ----------------------- | ------------------- |
| Runtime behavior        | SSM Parameter Store |
| System shape            | Git (IaC / policy)  |
| Secrets                 | Secrets Manager     |
| Feature flags           | SSM Parameter Store |
| Ownership               | Tags                |
| Constraints             | Git                 |
| Validation              | Code (schemas only) |
| Secrets for Development | .env file           |

---

## Mental Model

- **Git** decides _what is allowed_
- **SSM** decides _what is active_
- **Secrets Manager** decides _what is sensitive_
- **Tags** decide _who owns it_
- **Code** decides _how it is interpreted_

---

## Environment Precedence

1. System Environment Variables
2. `{stage}-env.ts` file

## Test Environments

NEEDS UPDATING

`loadConfig` is cached, so if it is called multiple times, it will return the same config object.
This means that the hook in testing: `beforeAll(() => setupTestConfig());` can be used to import test config which will take precedence over whatever else is called.

## Environments Defined in Code

In general, the environment variables are defined in the CICD deploy pipeline for the project.
However both test, and local, are defined in the corresponding files: `local-env.ts` and `test-env.ts` respectively.
This makes it easier to run these environments locally to speed up developer workflows.

### Rules

- Only secrets and endpoints should be required, all other variables should be optional.
- All environment variables should not have defaults.
- All environment variables should be validated against the schema.

### Config Object (config.ts)

- The config object is calculated from the environment variables.
- No environment variables should be referenced in the codebase, only the config object should be used.
- It is type-safe and controls all configuration for the application

## Prefer config.ts over nest config service

- Avoid using `configService: ConfigService` in the codebase, prefer using the config object directly.
- Use `config['key']` to access the config object.

## No Magic Numbers in Code

- Do not use magic numbers in the codebase, prefer using the config object to access the values. For example, defaults in pagination should be set in the config object:

```typescript
return {
  query,
  size: params.size ?? config['app.pagination.default.size'],
  from: params.from ?? config['app.pagination.default.from'],
}
```

This is better than using a magic number like 20, as it is more explicit and easier to understand. It also centralizes configuration of default values into the one place.

## Summary

This model ensures:

- clear ownership
- secure handling of secrets
- explicit runtime configuration
- auditable change history
- predictable deployments

Configuration becomes **intentional**, not incidental.

## Summary Table

| Concern       | Test                    | Local Dev                   | Cloud                 |
| ------------- | ----------------------- | --------------------------- | --------------------- |
| Config source | Explicit object in code | .env file                   | SSM + Secrets Manager |
| DB            | localhost / test DB     | Your server (192.168.7.224) | Aurora endpoint       |
| Secrets       | Hardcoded test values   | .env file                   | Secrets Manager       |
| NODE_ENV      | test                    | dev                         | prod                  |
| Committed?    | Yes (in test code)      | No (.env gitignored)        | No (infra-managed)    |
