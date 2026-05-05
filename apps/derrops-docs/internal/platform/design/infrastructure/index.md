---
id: index
title: Infrastructure
sidebar_label: Overview
sidebar_position: 1
---

# Infrastructure Design

Platform-wide infrastructure design: tenancy model, resource provisioning, tagging, and IaC conventions.

These documents are for platform engineers. They describe how Derrops provisions, names, tags, and isolates AWS resources. They are **not** customer-facing — see [docs/multi-tenancy](/docs/multi-tenancy) for the public overview.

## Documents

- [Conventions](./conventions) — domain registry, required AWS tags, CDK enforcement patterns, cost allocation, and IAM condition key patterns. Start here when adding a new stack or writing documentation.
- [Domain & Service Registry](./service-registry) — authoritative registry of every `derrops:domain` + `derrops:service` combination: active services, planned services, generated name patterns, and `DerropsConventions` instantiation examples. Start here when naming a new resource.
- [CloudFormation Stacks](./cloudformation-stacks) — authoritative registry of every CDK and Amplify CloudFormation stack: stack names, dependencies, resources, and all exports. **Update this whenever a stack is added, renamed, or removed.**
- [Multi-Tenancy](./multi-tenancy) — per-tenant resource catalogue, TenantConstruct, access control layers, lifecycle management
- [CDK Naming & Tagging Audit](./cdk-naming-tagging-audit) — verified current-state reference: all resource names, export names, and applied tags
