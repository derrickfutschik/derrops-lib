---
id: index
title: Infrastructure
sidebar_label: Overview
sidebar_position: 1
---

# Infrastructure Design

Platform-wide infrastructure design: tenancy model, resource provisioning, tagging, and IaC conventions.

These documents are for platform engineers. They describe how SLAOps provisions, names, tags, and isolates AWS resources. They are **not** customer-facing — see [docs/multi-tenancy](/docs/multi-tenancy) for the public overview.

## Documents

- [CloudFormation Stacks](./cloudformation-stacks) — authoritative registry of every CDK and Amplify CloudFormation stack: stack names, dependencies, resources, and all exports. **Update this whenever a stack is added, renamed, or removed.**
- [Platform Domains](./platform-domains) — authoritative domain registry: domain names, CDK tag values, responsibilities, and the services each domain owns. Start here when adding a new stack or writing documentation.
- [Multi-Tenancy](./multi-tenancy) — per-tenant resource catalogue, TenantConstruct, access control layers, lifecycle management
- [Tagging Conventions](./tagging-conventions) — required AWS tags, CDK enforcement, cost allocation, and IAM condition key patterns
- [CDK Naming & Tagging Audit](./cdk-naming-tagging-audit) — verified current-state reference: all resource names, export names, and applied tags
