---
slug: derrops-naming-sheet
title: Naming Cheatsheet for best Pracices
date: 2026-02-26
authors: [derrops]
tags: [devops, aws]
draft: false
---

:::tip Implementation
The patterns in this cheatsheet are implemented as a TypeScript library in the [`@derrops-conventions`](https://github.com/slaops/slaops-platform/tree/main/packages/derrops-conventions) package. For the full rationale behind these conventions see the [conventions guide](./derrops-conventions).
:::

# AWS Resource Naming Cheatsheet

Quick reference guide for naming AWS resources following the Derrops conventions. All examples assume **account-segregated environments** (preferred approach).

**Core Format:** `{org}--{domain}--{service}--{key}` (compound kebab-case with `--` segment delimiters)

---

## Template Variables Reference

Before using this cheatsheet, understand what each placeholder means:

| Variable                | Definition                                       | Example                                                       | Required?                                                           | Notes                                                                                      |
| ----------------------- | ------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `{region}`              | AWS region code                                  | `ap-southeast-2`, `us-east-1`, `eu-west-1`                    | ✅ Only for globally unique services (S3, CloudFront, ACM, Route53) | Omit if using account-per-region segregation                                               |
| `{env}`                 | Deployment environment                           | `prod`, `dev`, `staging`, `uat`                               | ✅ Only for globally unique services (S3) or DNS                    | Omit if using account-per-environment segregation (recommended)                            |
| `{org}`                 | Organization/top-level business unit             | `acme`, `mycompany`, `client-name`                            | ✅ Always required                                                  | Most stable segment; rarely changes                                                        |
| `{tenant}`              | Isolated tenant within the org (silo model only) | `t-a3f8b2`, `t-9c1d44`                                        | ✅ Silo model only                                                  | Always an **opaque ID**, never a human-readable name. See [Multi-Tenancy](#multi-tenancy). |
| `{domain}`              | Business capability / bounded domain             | `payments`, `identity`, `analytics`, `platform`               | ✅ Always required                                                  | Owned independently; more stable than teams                                                |
| `{service}`             | Deployable service unit                          | `checkout-api`, `auth-service`, `webhook-worker`              | ✅ Always required                                                  | The primary identity; can be renamed/refactored                                            |
| `{key}`                 | Specific resource or config within service       | `transactions`, `webhook-secret`, `primary`, `cache`          | ✅ Always required                                                  | Purpose-specific identifier; changes frequently                                            |
| `{partition}`           | Data partition grouping (logs, events only)      | `2024/01/15/14`, `2024-01-15`                                 | ❌ Optional; data storage only                                      | Only for time-series or partitioned data in S3/Glue                                        |
| `{purpose}`             | Functional purpose                               | `alb`, `db`, `lambda`, `encryption-enabled`                   | ✅ When needed for clarity                                          | Qualifies the resource type                                                                |
| `{type}`                | Resource subtype                                 | `web`, `worker`, `private`, `public`, `primary`, `replica`    | ✅ When distinguishing variants                                     | Makes specific instances identifiable                                                      |
| `{az}`                  | Availability zone                                | `1a`, `1b`, `1c`                                              | ✅ For multi-AZ resources                                           | Ensures subnets are distributed                                                            |
| `{consumer}`            | API consumer/client                              | `mobile-client`, `partner-integrations`, `internal`           | ✅ For API keys and access                                          | Identifies who consumes the resource                                                       |
| `{target}`              | Target system for data source                    | `dynamodb`, `rds`, `lambda`, `s3`                             | ✅ For integration points                                           | What the resource connects to                                                              |
| `{num}`                 | Sequential number                                | `01`, `02`, `03`                                              | ❌ Optional; for instance naming                                    | Zero-padded for sorting                                                                    |
| `{yyyy}/{mm}/{dd}/{hh}` | Date/time partitions                             | `2024/01/15/14`                                               | ✅ For time-series data only                                        | Each level is independently queryable                                                      |
| `{file}`                | Filename                                         | `transactions.json`, `logs.parquet`                           | ✅ For object/file storage                                          | The final artifact identifier                                                              |
| `{version}` or `{tag}`  | Semantic version or release tag                  | `1.2.3`, `latest`, `v2.0.0-beta`                              | ✅ For images and artifacts                                         | Identifies specific release                                                                |
| `{registry}`            | Container registry host                          | `123456789.dkr.ecr.ap-southeast-2.amazonaws.com`, `docker.io` | ✅ For container images                                             | Where the image is hosted                                                                  |

---

## Summary Table - All Services

| Service                                | Format                      | Pattern                                                              | Delimiter    | Example                                                                                 |
| -------------------------------------- | --------------------------- | -------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------- |
| **S3 Bucket**                          | Global + prefix             | `ap-southeast-2--prod--{org}--{domain}--{service}--{key}`            | `-`          | `ap-southeast-2--prod--acme--payments--checkout-api--backups`                           |
| **S3 Object Keys**                     | Hierarchy                   | `{org}/{domain}/{service}/{key}`                                     | `/`          | `acme/payments/checkout-api/schema.sql`                                                 |
| **S3 Logs/Events**                     | With partition              | `{org}/{domain}/{service}/{yyyy}/{mm}/{dd}/{hh}/{file}`              | `/`          | `acme/payments/checkout-api/2024/01/15/14/transactions-00001.json`                      |
| **CloudWatch Logs**                    | Hierarchy                   | `/{org}/{domain}/{service}/{key}`                                    | `/`          | `/acme/payments/checkout-api/application-logs`                                          |
| **CloudWatch Metrics (Namespace)**     | Hierarchy (org/domain only) | `{org}/{domain}`                                                     | `/`          | `acme/payments`                                                                         |
| **CloudWatch Metric (Dimensions)**     | Key-value pairs             | `service={service}` (env via account, not dimension)                 | N/A          | `service=checkout-api`, `service=order-processor`                                       |
| **CloudWatch Metric Names**            | Flat kebab                  | `{key}-{metric-type}`                                                | `-`          | `request-count`, `error-rate`, `latency-p99`                                            |
| **ECS Cluster**                        | Flat kebab                  | `{org}--{domain}--{service}--{key}`                                  | `--` / `-`   | `acme--payments--checkout-api--cluster`                                                 |
| **ECS Service**                        | Flat kebab                  | `{org}--{domain}--{service}`                                         | `--` / `-`   | `acme--payments--checkout-api`                                                          |
| **ECS Task Definition**                | Flat kebab                  | `{org}--{domain}--{service}`                                         | `--` / `-`   | `acme--payments--checkout-api`                                                          |
| **ECR Repository**                     | Registry path               | `{org}/{domain}/{service}`                                           | `/`          | `acme/payments/checkout-api`                                                            |
| **ECR Image Tag**                      | Semantic                    | `{registry}/{org}/{domain}/{service}:{version}`                      | `/ :`        | `123456789.dkr.ecr.ap-southeast-2.amazonaws.com/acme/payments/checkout-api:1.2.3`       |
| **DynamoDB Table**                     | Flat kebab                  | `{org}--{domain}--{service}--{key}`                                  | `--` / `-`   | `acme--payments--checkout-api--transactions`                                            |
| **DynamoDB GSI**                       | Flat kebab                  | `{key}--gsi`                                                         | `--` / `-`   | `transactions-by-user--gsi`                                                             |
| **RDS Instance ID**                    | Flat kebab                  | `{org}--{domain}--{service}--{key}`                                  | `--` / `-`   | `acme--payments--checkout-api--primary`                                                 |
| **RDS DB Name**                        | Flat snake                  | `{org}_{domain}_{service}`                                           | `_`          | `acme_payments_checkout_api`                                                            |
| **RDS Parameter Group**                | Flat kebab                  | `{org}--{domain}--{service}--{key}`                                  | `--` / `-`   | `acme--payments--checkout-api--params`                                                  |
| **RDS Subnet Group**                   | Flat kebab                  | `{org}--{domain}--{service}--subnet-group`                           | `--` / `-`   | `acme--payments--checkout-api--subnet-group`                                            |
| **EC2 Instance**                       | Flat kebab                  | `{org}--{domain}--{service}--{type}-{num}`                           | `--` / `-`   | `acme--payments--checkout-api--web-01`                                                  |
| **EC2 Security Group**                 | Flat kebab                  | `{org}--{domain}--{service}--{purpose}`                              | `--` / `-`   | `acme--payments--checkout-api--alb`                                                     |
| **EC2 Volume**                         | Flat kebab                  | `{org}--{domain}--{service}--volume-{purpose}`                       | `--` / `-`   | `acme--payments--checkout-api--volume-data`                                             |
| **EC2 Elastic IP**                     | Flat kebab                  | `{org}--{domain}--{service}--eip`                                    | `--` / `-`   | `acme--payments--checkout-api--eip`                                                     |
| **Lambda Function**                    | Flat kebab                  | `{org}--{domain}--{service}--{key}`                                  | `--` / `-`   | `acme--payments--checkout-api--webhook-handler`                                         |
| **Lambda Layer**                       | Flat kebab                  | `{org}--{domain}--{service}--{purpose}`                              | `--` / `-`   | `acme--shared-utilities--common-libs`                                                   |
| **Lambda Alias**                       | Simple                      | `prod`, `dev`, `staging`                                             | N/A          | `prod`                                                                                  |
| **IAM Role**                           | Path + name                 | Path: `/{org}/{domain}/{service}/` Name: `{service}--{purpose}-role` | `/` `--` `-` | ARN: `arn:aws:iam::123456789:role/acme/payments/checkout-api/checkout-api--lambda-role` |
| **IAM Policy**                         | Path + name                 | Path: `/{org}/{domain}/{service}/` Name: `{purpose}-policy`          | `/` `-`      | `acme--payments--checkout-api--s3-access-policy`                                        |
| **IAM User**                           | Flat kebab                  | `{org}--{domain}--{service}--user`                                   | `--` / `-`   | `acme--payments--checkout-api--service-user`                                            |
| **Route53 Hosted Zone**                | Subdomain                   | `prod.acme.com` (env from account)                                   | `.`          | `prod.acme.com`                                                                         |
| **Route53 DNS Record**                 | Reverse hierarchy           | `{service}.prod.acme.com`                                            | `.`          | `checkout-api.prod.acme.com`                                                            |
| **Route53 Private Zone**               | Internal DNS                | `{service}.internal.prod.acme.com`                                   | `.`          | `checkout-api.internal.prod.acme.com`                                                   |
| **CloudFront Distribution**            | Flat kebab                  | `{org}--{domain}--{service}--cdn`                                    | `--` / `-`   | `acme--payments--checkout-api--cdn`                                                     |
| **CloudFront Alias (CNAME)**           | DNS pattern                 | `{service}.prod.acme.com`                                            | `.`          | `checkout-api.prod.acme.com`                                                            |
| **ACM Certificate Domain**             | DNS pattern                 | `{service}.prod.acme.com`                                            | `.`          | `checkout-api.prod.acme.com`                                                            |
| **ACM Wildcard Cert**                  | DNS wildcard                | `*.prod.acme.com`                                                    | `.`          | `*.prod.acme.com`                                                                       |
| **VPC**                                | Flat kebab                  | `{org}--{domain}--{service}--vpc`                                    | `--` / `-`   | `acme--payments--checkout-api--vpc`                                                     |
| **Subnet**                             | Flat kebab                  | `{org}--{domain}--{service}--subnet-{type}-{az}`                     | `--` / `-`   | `acme--payments--checkout-api--subnet-private-1a`                                       |
| **Route Table**                        | Flat kebab                  | `{org}--{domain}--{service}--rt-{type}`                              | `--` / `-`   | `acme--payments--checkout-api--rt-private`                                              |
| **Network ACL**                        | Flat kebab                  | `{org}--{domain}--{service}--nacl`                                   | `--` / `-`   | `acme--payments--checkout-api--nacl`                                                    |
| **ALB/NLB**                            | Flat kebab                  | `{org}--{domain}--{service}--alb`                                    | `--` / `-`   | `acme--payments--checkout-api--alb`                                                     |
| **Target Group**                       | Flat kebab                  | `{org}--{domain}--{service}--tg-{purpose}`                           | `--` / `-`   | `acme--payments--checkout-api--tg-api`                                                  |
| **SNS Topic**                          | Flat kebab                  | `{org}--{domain}--{service}--{key}`                                  | `--` / `-`   | `acme--payments--checkout-api--transactions`                                            |
| **SQS Queue**                          | Flat kebab                  | `{org}--{domain}--{service}--{key}`                                  | `--` / `-`   | `acme--payments--checkout-api--events`                                                  |
| **SQS FIFO Queue**                     | Flat kebab                  | `{org}--{domain}--{service}--{key}.fifo`                             | `--` / `-`   | `acme--payments--checkout-api--events.fifo`                                             |
| **SQS DLQ**                            | Flat kebab                  | `{queue-name}--dlq`                                                  | `--` / `-`   | `acme--payments--checkout-api--events--dlq`                                             |
| **Kinesis Stream**                     | Flat kebab                  | `{org}--{domain}--{service}--{key}`                                  | `--` / `-`   | `acme--payments--checkout-api--events`                                                  |
| **EventBridge Bus**                    | Flat kebab                  | `{org}--{domain}--{service}--events`                                 | `--` / `-`   | `acme--payments--checkout-api--events`                                                  |
| **EventBridge Rule**                   | Flat kebab                  | `{org}--{domain}--{service}--{key}-rule`                             | `--` / `-`   | `acme--payments--checkout-api--process-webhook-rule`                                    |
| **Step Functions**                     | Flat kebab                  | `{org}--{domain}--{service}--{key}`                                  | `--` / `-`   | `acme--payments--checkout-api--order-processing`                                        |
| **API Gateway REST API**               | Flat kebab                  | `{org}--{domain}--{service}--api`                                    | `--` / `-`   | `acme--payments--checkout-api--api`                                                     |
| **API Gateway HTTP API**               | Flat kebab                  | `{org}--{domain}--{service}--http-api`                               | `--` / `-`   | `acme--payments--checkout-api--http-api`                                                |
| **API Gateway Stage**                  | Simple                      | `prod`, `dev`, `staging`                                             | N/A          | `prod`                                                                                  |
| **API Gateway Key**                    | Flat kebab                  | `{org}--{domain}--{service}--{consumer}`                             | `--` / `-`   | `acme--payments--checkout-api--mobile-client`                                           |
| **AppSync API**                        | Flat kebab                  | `{org}--{domain}--{service}--api`                                    | `--` / `-`   | `acme--payments--checkout-api--api`                                                     |
| **AppSync Data Source**                | Flat kebab                  | `{org}--{domain}--{service}--{target}`                               | `--` / `-`   | `acme--payments--checkout-api--dynamodb`                                                |
| **ElastiCache Cluster**                | Flat kebab                  | `{org}--{domain}--{service}--cache`                                  | `--` / `-`   | `acme--payments--checkout-api--cache`                                                   |
| **ElastiCache Replication Group**      | Flat kebab                  | `{org}--{domain}--{service}--replication-group`                      | `--` / `-`   | `acme--payments--checkout-api--replication-group`                                       |
| **ElastiCache Parameter Group**        | Flat kebab                  | `{org}--{domain}--{service}--params`                                 | `--` / `-`   | `acme--payments--checkout-api--params`                                                  |
| **OpenSearch Domain**                  | Flat kebab                  | `{org}--{domain}--{service}`                                         | `--` / `-`   | `acme--payments--checkout-api`                                                          |
| **OpenSearch Index**                   | Hierarchy                   | `{org}/{domain}/{service}/{key}/{date}`                              | `/`          | `acme/payments/checkout-api/transactions/2024-01-15`                                    |
| **RDS Proxy**                          | Flat kebab                  | `{org}--{domain}--{service}--proxy`                                  | `--` / `-`   | `acme--payments--checkout-api--proxy`                                                   |
| **AWS Backup Plan**                    | Flat kebab                  | `{org}--{domain}--{service}--backup-plan`                            | `--` / `-`   | `acme--payments--checkout-api--backup-plan`                                             |
| **AWS Backup Vault**                   | Flat kebab                  | `{org}--{domain}--{service}--vault`                                  | `--` / `-`   | `acme--payments--checkout-api--vault`                                                   |
| **Glue Database**                      | Flat snake                  | `{org}_{domain}_{service}`                                           | `_`          | `acme_payments_checkout_api`                                                            |
| **Glue Table**                         | Flat snake                  | `{key}`                                                              | N/A          | `transactions`                                                                          |
| **Glue Job**                           | Flat kebab                  | `{org}--{domain}--{service}--{key}-job`                              | `--` / `-`   | `acme--analytics--etl--transform-job`                                                   |
| **Glue Crawler**                       | Flat kebab                  | `{org}--{domain}--{service}--{key}-crawler`                          | `--` / `-`   | `acme--analytics--data-crawlers`                                                        |
| **Athena Workgroup**                   | Flat kebab                  | `{org}--{domain}--{service}--workgroup`                              | `--` / `-`   | `acme--analytics--etl--workgroup`                                                       |
| **Athena Results Bucket**              | S3 key path                 | `s3://bucket/{org}/{domain}/{service}/`                              | `/`          | `s3://acme-analytics-athena-results/acme/analytics/etl/`                                |
| **QuickSight Dataset**                 | Flat kebab                  | `{org}--{domain}--{service}--dataset`                                | `--` / `-`   | `acme--analytics--transactions--dataset`                                                |
| **QuickSight Analysis**                | Flat kebab                  | `{org}--{domain}--{service}--{key}-analysis`                         | `--` / `-`   | `acme--analytics--revenue-dashboard--analysis`                                          |
| **QuickSight Dashboard**               | Flat kebab                  | `{org}--{domain}--{service}--{key}`                                  | `--` / `-`   | `acme--analytics--revenue-dashboard`                                                    |
| **Redshift Cluster**                   | Flat kebab                  | `{org}--{domain}--{service}--cluster`                                | `--` / `-`   | `acme--analytics--warehouse--cluster`                                                   |
| **Redshift Database**                  | Flat snake                  | `{org}_{domain}_{service}`                                           | `_`          | `acme_analytics_warehouse`                                                              |
| **Redshift Subnet Group**              | Flat kebab                  | `{org}--{domain}--{service}--subnet-group`                           | `--` / `-`   | `acme--analytics--warehouse--subnet-group`                                              |
| **MSK Cluster**                        | Flat kebab                  | `{org}--{domain}--{service}--cluster`                                | `--` / `-`   | `acme--events--streaming--cluster`                                                      |
| **Kafka Topic**                        | Dotted path                 | `{org}.{domain}.{service}.{key}`                                     | `.`          | `acme.payments.checkout-api.transactions`                                               |
| **AppConfig Application**              | Flat kebab                  | `{org}--{domain}--{service}`                                         | `--` / `-`   | `acme--payments--checkout-api`                                                          |
| **AppConfig Environment**              | Simple                      | `prod`, `dev`, `staging`                                             | N/A          | `prod`                                                                                  |
| **AppConfig Profile**                  | Flat kebab                  | `{org}--{domain}--{service}--{key}-profile`                          | `--` / `-`   | `acme--payments--checkout-api--feature-flags-profile`                                   |
| **Systems Manager Document**           | Flat kebab                  | `{org}--{domain}--{service}--{key}`                                  | `--` / `-`   | `acme--payments--checkout-api--runbook`                                                 |
| **Systems Manager Maintenance Window** | Flat kebab                  | `{org}--{domain}--{service}--maintenance`                            | `--` / `-`   | `acme--payments--checkout-api--patching-window`                                         |
| **Service Catalog Portfolio**          | Flat kebab                  | `{org}--{domain}--portfolio`                                         | `--` / `-`   | `acme--payments--portfolio`                                                             |
| **Service Catalog Product**            | Flat kebab                  | `{org}--{domain}--{service}--product`                                | `--` / `-`   | `acme--payments--checkout-api--product`                                                 |
| **X-Ray Sampling Rule**                | Flat kebab                  | `{org}--{domain}--{service}--sampling-rule`                          | `--` / `-`   | `acme--payments--checkout-api--sampling-rule`                                           |
| **Config Rule**                        | Flat kebab                  | `{org}--{domain}--{service}--{key}-rule`                             | `--` / `-`   | `acme--payments--checkout-api--encryption-enabled-rule`                                 |
| **Config Aggregator**                  | Flat kebab                  | `{org}--{domain}--config-aggregator`                                 | `--` / `-`   | `acme--payments--config-aggregator`                                                     |
| **Security Hub Custom Insight**        | Flat kebab                  | `{org}--{domain}--{service}--{key}-insight`                          | `--` / `-`   | `acme--payments--checkout-api--critical-findings-insight`                               |
| **WAF Web ACL**                        | Flat kebab                  | `{org}--{domain}--{service}--waf`                                    | `--` / `-`   | `acme--payments--checkout-api--waf`                                                     |
| **WAF IP Set**                         | Flat kebab                  | `{org}--{domain}--{service}--{purpose}-ipset`                        | `--` / `-`   | `acme--payments--checkout-api--blocked-ips`                                             |
| **WAF Rule Group**                     | Flat kebab                  | `{org}--{domain}--{service}--rules`                                  | `--` / `-`   | `acme--payments--checkout-api--rate-limit-rules`                                        |
| **CloudFormation Stack**               | Flat kebab                  | `{org}--{domain}--{service}--{key}-stack`                            | `--` / `-`   | `acme--payments--checkout-api--stack`                                                   |
| **SSM Parameter**                      | Hierarchy                   | `/{org}/{domain}/{service}/{key}`                                    | `/`          | `/acme/payments/checkout-api/stripe-webhook-secret`                                     |
| **Secrets Manager Secret**             | Hierarchy                   | `{org}/{domain}/{service}/{key}`                                     | `/`          | `acme/payments/checkout-api/db-password`                                                |
| **Auto Scaling Group**                 | Flat kebab                  | `{org}--{domain}--{service}--asg`                                    | `--` / `-`   | `acme--payments--checkout-api--asg`                                                     |
| **Launch Template**                    | Flat kebab                  | `{org}--{domain}--{service}--launch-template`                        | `--` / `-`   | `acme--payments--checkout-api--launch-template`                                         |

---

## Multi-Tenancy

**Customer ≠ Tenant.** A customer may own multiple tenants. At the resource level, only `{tenant}` is meaningful — `{customer}` never appears in naming.

Within an org, resources belong to one of two namespace types:

| Namespace                     | Who owns it                                        | Prefix pattern                             | Example                                            |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------ | -------------------------------------------------- |
| **Tenant-scoped** (silo only) | A specific tenant's isolated infrastructure        | `/{org}/{tenant}/{domain}/{service}/{key}` | `/acme/t-a3f8b2/payments/checkout-api/stripe-key`  |
| **Shared / platform**         | The org itself; serves all tenants or internal ops | `/{org}/{domain}/{service}/{key}`          | `/acme/platform/billing-aggregator/stripe-api-key` |

| Model                                | `{tenant}` in resource names?           | Where tenant appears instead                                 |
| ------------------------------------ | --------------------------------------- | ------------------------------------------------------------ |
| **Silo** (per-tenant infrastructure) | ✅ Yes — between `{org}` and `{domain}` | Resource names, IAM paths, S3 prefixes                       |
| **Pool** (shared infrastructure)     | ❌ No                                   | S3 object key partitions, DynamoDB partition keys, app logic |

**Always use an opaque tenant ID, never a human-readable name:**

| Format                 | Example    | Risk                                                                                        |
| ---------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| ❌ Human-readable slug | `bigcorp`  | S3 namespace squatting: bad actor pre-registers `ap-southeast-2--prod--acme--bigcorp--data` |
| ✅ Opaque short ID     | `t-a3f8b2` | Not guessable; stable even if tenant rebrands                                               |

### Tenant Placement: Tenant-First vs Tenant-Second-Last

The position of `{tenant}` encodes the architectural relationship between tenant and service. See the full tradeoff discussion in the conventions guide. Summary:

| Placement              | Structure                                  | Primary axis   | Cross-tenant prefix queries                               | Per-tenant IAM prefix               |
| ---------------------- | ------------------------------------------ | -------------- | --------------------------------------------------------- | ----------------------------------- |
| **Tenant-first**       | `/{org}/{tenant}/{domain}/{service}/{key}` | Tenant (silo)  | ❌ Not possible — must enumerate + assume role per tenant | ✅ Single prefix                    |
| **Tenant-second-last** | `/{org}/{domain}/{service}/{tenant}/{key}` | Service (pool) | ✅ `/acme/payments/checkout-api/*`                        | ❌ Must enumerate all service paths |

**Choose tenant-first when:** operations are primarily per-tenant; cross-tenant services consume from shared aggregation layers (EventBridge, Kinesis, data lake); you need hard per-tenant IAM boundaries.

**Choose tenant-second-last when:** services regularly need direct wildcard access across tenant data; service is the primary organizational unit; tenants are data partitions within a shared deployment.

**If you need both:** build a shared aggregation layer for cross-tenant services and keep tenant-first for infrastructure. No single placement solves a hybrid model — that tension lives in the architecture, not the naming.

**Push vs Pull for cross-tenant data:**

The cross-tenant constraint of tenant-first is resolved by inverting the data flow. Instead of a cross-tenant service _pulling_ from tenant namespaces (crossing tenant boundaries, requiring broad IAM access), tenant services _push_ outbound to a shared aggregation layer:

| Model    | Data flow                                           | Aggregator access                | Tenant boundary |
| -------- | --------------------------------------------------- | -------------------------------- | --------------- |
| **Pull** | Aggregator reads from each tenant namespace         | Read into every tenant namespace | ❌ Crossed      |
| **Push** | Each tenant's service publishes to shared bus/store | Read from shared bus only        | ✅ Intact       |

```
# Pull (avoid) — billing aggregator crosses tenant boundaries
billing-aggregator → reads /acme/t-a3f8b2/payments/checkout-api/events
billing-aggregator → reads /acme/t-9c1d44/payments/checkout-api/events

# Push (preferred) — each tenant publishes outward, aggregator reads shared layer
checkout-api (t-a3f8b2) → publishes → shared EventBridge bus → billing-aggregator
checkout-api (t-9c1d44) → publishes → shared EventBridge bus → billing-aggregator
```

With push, the billing aggregator lives in the shared/platform namespace and needs no tenant namespace access at all. Tenant isolation is preserved in both directions. New tenants automatically publish to the same bus — no IAM changes to the aggregator required.

Pull is appropriate for operations that are inherently state-inspecting and cannot be redesigned as push: compliance scanning of resource configs, security auditing, operational tooling that reads current state. These are exceptional administrative patterns, not everyday data flows.

**Customer-scoped aggregation across multiple tenants:**

A customer may own multiple tenants and need aggregated reporting across them. The customer→tenant mapping lives in a **tenant registry** — not the naming convention. Events pushed to the shared layer carry both `tenant_id` and `customer_id` as metadata, enabling filtering at either level:

```
# Tenant pushes with customer context
checkout-api (t-a3f8b2, customer c-xk9p) → publishes {tenant_id, customer_id} → shared layer
checkout-api (t-9c1d44, customer c-xk9p) → publishes {tenant_id, customer_id} → shared layer

# Reporting reads from shared layer only — no tenant namespace access
reporting-service → filter customer_id=c-xk9p → aggregated view across all customer's tenants
```

If storing in a data lake (S3), partition by customer then tenant in the object key:

| Object key prefix                          | Scope                                     |
| ------------------------------------------ | ----------------------------------------- |
| `acme/analytics/billing/c-xk9p/*`          | All events across this customer's tenants |
| `acme/analytics/billing/c-xk9p/t-a3f8b2/*` | Events for one specific tenant            |

`{customer}` in an object key path is a data partition, not an infrastructure identifier — it does not violate the naming convention. `{customer}` still never appears in resource names (bucket names, Lambda functions, IAM roles, etc.).

**Silo model naming patterns:**

| Resource                          | Pattern                                       | Example                                                             |
| --------------------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| SSM Parameter                     | `/{org}/{tenant}/{domain}/{service}/{key}`    | `/acme/t-a3f8b2/payments/checkout-api/stripe-key`                   |
| S3 Object Key (per-tenant bucket) | `{org}/{domain}/{service}/{key}`              | `acme/payments/checkout-api/schema.sql` (bucket is tenant boundary) |
| Lambda Function                   | `{org}--{tenant}--{domain}--{service}--{key}` | `acme--t-a3f8b2--payments--checkout-api--webhook-handler`           |
| DynamoDB Table                    | `{org}--{tenant}--{domain}--{service}--{key}` | `acme--t-a3f8b2--payments--checkout-api--transactions`              |
| IAM Path                          | `/{org}/{tenant}/{domain}/{service}/`         | `/acme/t-a3f8b2/payments/checkout-api/`                             |

**Shared/platform naming patterns (no tenant segment):**

| Resource        | Pattern                             | Example                                               |
| --------------- | ----------------------------------- | ----------------------------------------------------- |
| SSM Parameter   | `/{org}/{domain}/{service}/{key}`   | `/acme/platform/billing-aggregator/stripe-api-key`    |
| Lambda Function | `{org}--{domain}--{service}--{key}` | `acme--platform--billing-aggregator--invoice-handler` |
| IAM Path        | `/{org}/{domain}/{service}/`        | `/acme/platform/billing-aggregator/`                  |

**Pool model — tenant in data only:**

| Resource                          | Where tenant appears         | Example                                              |
| --------------------------------- | ---------------------------- | ---------------------------------------------------- |
| S3 Object Key                     | As partition within the path | `acme/payments/checkout-api/t-a3f8b2/events.json`    |
| DynamoDB                          | Partition key                | `PK: TENANT#t-a3f8b2`                                |
| SSM (if per-tenant config needed) | After service prefix         | `/acme/payments/checkout-api/t-a3f8b2/feature-flags` |

### S3: Bucket Name vs Object Key Prefix

S3 requires a decision on whether tenant isolation lives in the **bucket name** or the **object key prefix**:

| Approach                     | Bucket                                                               | Key                                            | Use when                                                                    |
| ---------------------------- | -------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| **Shared bucket** (Pool)     | `acme--payments--checkout-api--data`                                 | `t-a3f8b2/events/2024/01/15/transactions.json` | Shared storage is acceptable; IAM `s3:prefix` conditions enforce isolation  |
| **Per-tenant bucket** (Silo) | `ap-southeast-2--prod--acme--t-a3f8b2--payments--checkout-api--data` | `events/2024/01/15/transactions.json`          | Hard isolation required (compliance, KMS per tenant, per-tenant audit logs) |

In the silo case, `{tenant}` appears in the **bucket name** and is omitted from object keys — the bucket is already the boundary. Always use an opaque tenant ID in bucket names: bucket names are globally unique and a human-readable name is squattable.

---

## ⚠️ Critical: Native Hierarchy Detection

**Many services support their own native hierarchical constructs.** Always check if a service has native hierarchy support BEFORE applying `--` segment delimiters. Using native hierarchies enables:

- Prefix filtering and querying
- Permission scoping via path-based policies
- Better operational organization
- Automatic drill-down capabilities in console

**Example:** CloudWatch metrics require careful structure:

- **Namespace** uses `/` for org/domain ONLY (e.g., `acme/payments`) ← **USE THIS FOR HIERARCHY**
- **Dimensions** include `service={service}` (e.g., `service=checkout-api`); env via account boundary ← **USE THIS FOR CROSS-SERVICE QUERIES**
- **Metric names** use `-` for words only (e.g., `request-count`, `error-rate`) ← Use this for specifics

Why? This enables meaningful queries like "all services in payments domain with high CPU" by filtering the service dimension, not namespaces. Each account's metrics are naturally isolated, maintaining permission boundaries while maximizing query utility!

---

## Delimiter Decision Matrix

| Use Case                                          | Default Delimiter    | Notes                                                        | When to Override                                | Services                                                                                         |
| ------------------------------------------------- | -------------------- | ------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Segment separator** (org↔domain↔service↔key) | `--` (double hyphen) | Separates major naming segments; most readable               | **ALWAYS check for native hierarchy first**     | All flat resource names                                                                          |
| **Word within segment**                           | `-` (hyphen)         | Words/parts within a single segment                          | Never—always use `-` for words                  | All resource names                                                                               |
| **Path hierarchy (native)**                       | `/` (slash)          | Native hierarchical support—use instead of `--`              | **Use `/` instead of `--` when available**      | S3 keys, SSM Parameters, Secrets, IAM paths, ECR, CloudWatch Logs, CloudWatch Metrics namespaces |
| **DNS hierarchy (native)**                        | `.` (dot)            | Native DNS subdomain separation—use instead of `--`          | **Use `.` instead of `--` when available**      | Route53, DNS records, CloudFront aliases, Kafka topics                                           |
| **Image tag/version (native)**                    | `:` (colon)          | Native registry delimiter for versioning                     | Use `:` after image name                        | ECR, Docker registries                                                                           |
| **Database internal names**                       | `_` (underscore)     | DB-friendly; only for internal schema names, NOT identifiers | Use `_` instead of `-` for DB/schema names only | RDS database names, Glue databases                                                               |

---

## Global vs Regional Scope

| Resource Type            | Scope                   | Includes region?        | Includes env?                  | Example                                                       |
| ------------------------ | ----------------------- | ----------------------- | ------------------------------ | ------------------------------------------------------------- |
| S3 Buckets               | Globally unique         | ✅ Yes (ap-southeast-2) | ✅ Yes (prod)                  | `ap-southeast-2--prod--acme--payments--checkout-api--backups` |
| Route53 Hosted Zones     | Global DNS              | ❌ No                   | ✅ Via account (prod.acme.com) | `prod.acme.com`                                               |
| CloudFront Distributions | Global CDN              | ❌ No                   | ✅ Via DNS (prod)              | `checkout-api.prod.acme.com`                                  |
| ACM Certificates         | Global DNS              | ❌ No                   | ✅ Via DNS (prod)              | `checkout-api.prod.acme.com`                                  |
| IAM Roles                | Global (within account) | ❌ No                   | ❌ No (via account)            | `/acme/payments/checkout-api/checkout-api-role`               |
| All Regional Services    | Regional                | ❌ No (via account)     | ❌ No (via account)            | `acme-payments-checkout-api`                                  |

---

## Native Hierarchy Support

**PRIORITY: Always use native hierarchies when available.** They provide operational benefits flat names cannot.

| Service                            | Native Support | Delimiter             | Example                                              | Benefit                                                                   |
| ---------------------------------- | -------------- | --------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| **S3 Object Keys**                 | ✅ YES         | `/`                   | `acme/payments/checkout-api/schema.sql`              | Prefix filtering, drill-down in console                                   |
| **SSM Parameter Store**            | ✅ YES         | `/`                   | `/acme/payments/checkout-api/stripe-key`             | GetParametersByPath queries, IAM scoping                                  |
| **Secrets Manager**                | ✅ YES         | `/`                   | `acme/payments/checkout-api/db-password`             | Prefix filtering, organized in console                                    |
| **IAM Paths**                      | ✅ YES         | `/`                   | `/acme/payments/checkout-api/`                       | Path-based IAM policies, permission scoping                               |
| **ECR Repositories**               | ✅ YES         | `/`                   | `acme/payments/checkout-api`                         | Namespace organization in console                                         |
| **CloudWatch Logs**                | ✅ YES         | `/`                   | `/acme/payments/checkout-api/logs`                   | Log group filtering and organization                                      |
| **CloudWatch Metrics (Namespace)** | ✅ YES         | `/` (org/domain only) | `acme/payments`                                      | Namespace filtering; `service` as dimension enables cross-service queries |
| **OpenSearch Indices**             | ✅ YES         | `/`                   | `acme/payments/checkout-api/transactions/2024-01-15` | Index pattern matching, time-series organization                          |
| **Route53 DNS**                    | ✅ YES         | `.`                   | `checkout-api.payments.acme.com`                     | DNS delegation, zone scoping                                              |
| **Kafka Topics**                   | ✅ YES         | `.`                   | `acme.payments.checkout-api.events`                  | Topic organization, consumer group scoping                                |
| **DynamoDB Tables**                | ❌ NO          | `-`                   | Use `{org}--{domain}--{service}--{key}`              | No hierarchy support; use `--` delimiters                                 |
| **RDS Instances**                  | ❌ NO          | `-`                   | Use `{org}--{domain}--{service}--{key}`              | No hierarchy support; use `--` delimiters                                 |
| **Lambda Functions**               | ❌ NO          | `-`                   | Use `{org}--{domain}--{service}--{key}`              | No hierarchy support; use `--` delimiters                                 |
| **ECS/EC2 Resources**              | ❌ NO          | `-`                   | Use `{org}--{domain}--{service}--{key}`              | No hierarchy support; use `--` delimiters                                 |

---

## Common Pitfalls & Solutions

| Pitfall                                                | Problem                                                            | Why It Matters                                                                                                 | Solution                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Using human-readable tenant names in global namespaces | S3/CloudFront names are globally unique and predictable            | Bad actor pre-registers `prod--acme--bigcorp--data` before you onboard `bigcorp`, causing provisioning failure | Use opaque tenant IDs (`t-a3f8b2`) — not guessable, stable even if tenant rebrands               |
| Using `{customer}` instead of `{tenant}` in naming     | Customer is a business entity; a customer may own multiple tenants | Creates ambiguity and naming collisions if a customer has more than one tenant                                 | Only `{tenant}` appears in resource names; customer→tenant mapping lives in your tenant registry |
| Using `_` in S3 bucket names                           | S3 rejects underscores                                             | S3 bucket naming constraint                                                                                    | Use `-` (hyphens) everywhere                                                                     |
| Inconsistent names across environments                 | Cannot query resources across envs                                 | Breaks filtering in CloudWatch, Config, Security Hub                                                           | Use identical logical names in all accounts                                                      |
| Including `{env}` when account-segregated              | Redundant naming; violates consistency principle                   | Names become longer, harder to read; breaks queries                                                            | Omit `{env}` if managing via account boundaries                                                  |
| Randomly suffixed names                                | Names become unpredictable                                         | Makes automation fragile; breaks IaC                                                                           | Use account/region namespace for uniqueness                                                      |
| Changing `{org}` or `{domain}`                         | Breaks all downstream references and policies                      | All IAM policies, CloudWatch filters, and automation fail                                                      | Keep these segments stable; only change `{service}`                                              |
| Not using native delimiters                            | Loses prefix querying capability                                   | Cannot use S3 prefix filtering, SSM GetParametersByPath                                                        | Use `/` for hierarchical systems, `.` for DNS                                                    |
| DNS names don't mirror resources                       | Routing confusion; cross-team coordination failure                 | Applications cannot find correct endpoints                                                                     | DNS = reversed hierarchy (service.domain.org.com)                                                |
| Resource name > service character limit                | Truncation breaks convention                                       | Names get auto-truncated; cannot predict final name                                                            | Test limits early; use shorter domain/service names                                              |
| Mixed kebab and snake case                             | Tools cannot parse consistently                                    | Scripts fail; team confusion; automation breaks                                                                | Use kebab-case (`-`) for all naming except DB internals                                          |
| Forgetting tagging for cost allocation                 | Cannot allocate costs accurately                                   | Wrong cost attribution; misleading cost reports                                                                | Tag every resource with CostCenter, Owner, Service                                               |

---

## Quick Reference by Layer

### Infrastructure Layer

```
VPC: acme--payments--checkout-api--vpc
Subnet: acme--payments--checkout-api--subnet-private-1a
Security Group: acme--payments--checkout-api--alb
```

### Compute Layer

```
ECS Cluster: acme--payments--checkout-api--cluster
ECS Service: acme--payments--checkout-api
EC2 Instance: acme--payments--checkout-api--web-01
Lambda: acme--payments--checkout-api--webhook-handler
```

### Data Layer

```
DynamoDB: acme--payments--checkout-api--transactions
RDS Instance: acme--payments--checkout-api--primary
RDS Database: acme_payments_checkout_api
ElastiCache: acme--payments--checkout-api--cache
S3 Bucket: ap-southeast-2--prod--acme--payments--checkout-api--data
```

### Messaging Layer

```
SNS Topic: acme--payments--checkout-api--transactions
SQS Queue: acme--payments--checkout-api--events
SQS DLQ: acme--payments--checkout-api--events--dlq
Kinesis Stream: acme--payments--checkout-api--events
```

### Integration Layer

```
API Gateway: acme--payments--checkout-api--api
Step Functions: acme--payments--checkout-api--order-processing
EventBridge Rule: acme--payments--checkout-api--process-webhook-rule
```

### Observability Layer

```
CloudWatch Logs: /acme/payments/checkout-api/application-logs
CloudWatch Metrics:
  Namespace: acme/payments (org/domain only)
  Dimensions: service=checkout-api (env via account boundary)
  Metric Name: request-count, error-rate, latency-p99
  Example Query: "All high-CPU services in payments" → Query namespace acme/payments, filter by service dimension
  Permission Boundary: Account segregation; no env dimension needed
X-Ray Rule: acme--payments--checkout-api--sampling-rule
Config Rule: acme--payments--checkout-api--encryption-enabled-rule
```

### Security Layer

```
IAM Role: /acme/payments/checkout-api/checkout-api--lambda-role
IAM Policy: acme--payments--checkout-api--s3-access-policy
WAF Web ACL: acme--payments--checkout-api--waf
ACM Certificate: checkout-api.prod.acme.com
```

### DNS Layer

```
Hosted Zone: prod.acme.com
DNS Record: checkout-api.prod.acme.com
Route53 Private Zone: checkout-api.internal.prod.acme.com
CloudFront Alias: checkout-api.prod.acme.com
```

### Storage/Config Layer

```
S3 Object Key: acme/payments/checkout-api/schema.sql
SSM Parameter: /acme/payments/checkout-api/stripe-webhook-secret
Secrets Manager: acme/payments/checkout-api/db-password
```

---

## Tagging Strategy

Apply these tags to **all** resources for cost allocation and resource management:

| Tag Key           | Value            | Example         | Purpose                        |
| ----------------- | ---------------- | --------------- | ------------------------------ |
| `org`             | Organization     | `acme`          | Top-level ownership            |
| `domain`          | Business domain  | `payments`      | Capability boundary            |
| `service`         | Service name     | `checkout-api`  | Deployment unit                |
| `environment`     | Deployment stage | `prod`          | Optional if account-segregated |
| `owner`           | Team/person      | `payments-team` | Responsibility tracking        |
| `cost-center`     | Cost allocation  | `payments-team` | Billing attribution            |
| `backup-required` | boolean          | `true`          | Backup policy enforcement      |
| `terraform`       | boolean          | `true`          | IaC management indicator       |

---

## Implementation Checklist

- [ ] **Define segments:** org, domain, service values
- [ ] **Account strategy:** 1 per environment? (Recommended: yes)
- [ ] **Test naming:** Create 1-2 sample resources in non-prod
- [ ] **Document exceptions:** Route53 reverse hierarchy, DNS patterns
- [ ] **Create IAM policies:** Use path prefixes for least privilege
- [ ] **Enable AWS Config:** Enforce naming patterns automatically
- [ ] **Set up tagging:** Apply tags to non-nameable resources
- [ ] **Create runbooks:** How to find resources by naming convention
- [ ] **Train team:** Share cheatsheet and examples
- [ ] **Monitor drift:** Regular audits for non-compliant names

---

## Format Comparison Examples

| Use Case                    | Prefix Hierarchy                             | DNS Reverse                      | Flat Kebab                          | Result                                 |
| --------------------------- | -------------------------------------------- | -------------------------------- | ----------------------------------- | -------------------------------------- |
| Same service across systems | `/acme/payments/checkout-api`                | `checkout-api.payments.acme.com` | `acme-payments-checkout-api`        | ✅ All represent same logical resource |
| Different purposes          | `/acme/payments/checkout-api/orders`         | N/A                              | `acme-payments-checkout-api-orders` | ✅ Additional scope via suffix         |
| Env segregated              | `/acme/prod/payments/checkout-api`           | `checkout-api.prod.acme.com`     | ❌ Not used (handled via account)   | ✅ Account provides namespace          |
| With partition (logs)       | `acme/payments/checkout-api/2024/01/15/logs` | N/A                              | N/A                                 | ✅ Hierarchical querying in S3         |

---

## One-Liner Reference

**Need to name a resource?** Apply this logic in order:

1. Does it support native hierarchy? → Use it (`/` for paths, `.` for DNS)
2. Is it globally unique (S3, ACM, CloudFront)? → Add `ap-southeast-2--prod--` prefix (literal region and env values)
3. Is it DNS-based? → Use reverse hierarchy: `{service}.prod.acme.com` (env in domain via account)
4. Otherwise → Use format: `{org}-{domain}-{service}-{key}` with `-` delimiters, `--` between segments
5. Tag everything else that doesn't support naming
