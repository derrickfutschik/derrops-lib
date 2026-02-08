---
slug: components
title: Components
authors: [derrops]
tags: [components]
---

The following diagram shows the components of the SLAOps platform. Logs flow from the customer app to the SLAOps platform and then to the Opensearch database.

```mermaid Flowchart

flowchart LR

     App[SLAOpsApp]
     --> |Manage| Lambda[Lambda Log Ingestion]
     OS --> |Query| App
     OS[Opensearch]
     S3[S3 Raw Logs]

CustomerApp[Customer App] --> |SLAOps SDK| S3
CustomerApp --> |Read Configuration| App

    S3 --> |S3 Events| Lambda
    Lambda --> OS

    Lambda --> S3Raw[Request & Response S3]
     S3Raw--> |Download Full Requests| App



```

### SLAOps SDK

- Code to log request and response into S3 bucket.
- Read the configuration from the `SLAOpsApp`.
- Configured with permissions to read the configuration.

### Lambda Log Ingestion

- Read Configuration from the `SLAOpsApp`.
- Read the logs from the S3 bucket.
- Parse the logs into the OpenAPI Intelligence format.
- Store the logs in the Opensearch database.

### Opensearch Database

- Store the logs in the Opensearch database.
- Store the configuration in the Opensearch database.
- Store the metrics in the Opensearch database.
- Store the alerts in the Opensearch database.
- Store the dashboards in the Opensearch database.
- Store the users in the Opensearch database.
