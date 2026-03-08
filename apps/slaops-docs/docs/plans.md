---
title: Plans
description: Information about the Tenancy
---

# Features

| Feature            | Free | Basic | SAAS   | Enterprise |
| ------------------ | ---- | ----- | ------ | ---------- |
| Users              | 1    | 1     | 10     | Unlimited  |
| API Management     | -    | ✅    | ✅     | ✅         |
| SSO                | 0    | -     | -      | ✅         |
| Log Enrichment     | 0    | -     | -      | ✅         |
| [BYOK](./byok.md)  | 0    | -     | ✅     | ✅         |
| Log Storage Engine | 0    | -     | Shared | Dedicated  |
| Self Hosted Logs   | 0    | -     | -      | ✅         |
| IP WhiteListing    | 0    | -     | -      | ✅         |
| Private Link       | 0    | -     | -      | ✅         |

| **Usage**         | -   | -   | -                         | -     |
| ----------------- | --- | --- | ------------------------- | ----- |
| Fee Storage       | 1GB | 5GB | 20GB                      | 100GB |
| Docs per Day      | 100 | 200 | 1000 + 1$ per 10,000 docs | 100GB |
| Ingestion per day | 100 | 200 | 1000 + 1$ per 10,000 docs | 100GB |
| Indexing per day  | 100 | 200 | 1000 + 1$ per 10,000 docs | 100GB |

:::note
Customers can configure whether they want to:

- Pay for usage exceeding their included usage
- Set a maximum threshold
- Stop processing additional requests exceeding their usage
  :::

:::note
When usage is exceeded, the sync operation between the customer's S3 bucket and our S3 bucket will be paused.
Customers will be able to see the difference (no of data points) and approx cost to index that data if it restarted again.
Optionally, customers can decide to only chat
:::
