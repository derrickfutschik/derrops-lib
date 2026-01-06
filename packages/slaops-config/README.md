# Configuration & Secrets Ownership Guide

This document defines **where configuration and secrets live**, **why**, and **the rules governing each layer**.  
The goal is to make configuration **explicit, auditable, secure, and predictable**.

---

## Where does configuration live?

Configuration is split into **layers**, each with a **clear responsibility**.  
No single system should answer every question.

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

### Rule

> If a value is required to run, it **must be explicitly provided** by configuration.

The only acceptable “defaults” are:

- schema-level constraints
- policy-level allowed ranges
- validation rules

---

## Where should configuration live?

| Value type       | Where it lives      |
| ---------------- | ------------------- |
| Runtime behavior | SSM Parameter Store |
| System shape     | Git (IaC / policy)  |
| Secrets          | Secrets Manager     |
| Feature flags    | SSM Parameter Store |
| Ownership        | Tags                |
| Constraints      | Git                 |
| Validation       | Code (schemas only) |

---

## Mental Model

- **Git** decides _what is allowed_
- **SSM** decides _what is active_
- **Secrets Manager** decides _what is sensitive_
- **Tags** decide _who owns it_
- **Code** decides _how it is interpreted_

---

## Summary

This model ensures:

- clear ownership
- secure handling of secrets
- explicit runtime configuration
- auditable change history
- predictable deployments

Configuration becomes **intentional**, not incidental.
