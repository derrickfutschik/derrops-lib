---
slug: deployments
title: Deployment Options
authors: [derrops]
tags: [tenancy, deployment, aws]
---

# Log Deployment Options

## Option 1 - Customer Bucket to our S3 Bucket Via Replication

Preferred option, customer can maintain their own logs in their own S3 bucket and we will replicate them to our S3 bucket.

```mermaid Flowchart

flowchart LR
    
    subgraph Customer["Customer AWS Environment"]
    Z[Client App] --> |SLAOps SDK| AClient[S3]
    
    end

    subgraph SLAOps["SLAOps AWS Environment"]
        A[S3]
        AClient[S3] --> |Replication| A[S3]
        A -->|lambda| B[Opensearch]
    end

```


## (Not yet implemented) Option 2 - Direct to our S3 Bucket

Cheapest option, customer does not need to maintain any logs, but will not have access to raw logs.

```mermaid Flowchart

flowchart LR
    
    Z[Client App] --> |SLAOps SDK| A[S3]

subgraph client["Client AWS Environment"]
    Z[Client App] 
end

    subgraph SLAOps["SLAOps AWS Environment"]
        A[S3]
        A -->|lambda| B[Opensearch]
    end

```




## (Not yet implemented) Option 3 - Customer Managed Deployment

Customer must manage and maintain the solution in their own AWS environment which requires more maintenance and management overhead.

```mermaid Flowchart

flowchart LR
    subgraph client["Client AWS Environment"]
    Z[Client App] --> |SLAOps SDK| AClient[S3]
    AClient[S3] -->|lambda| B[Opensearch]
    end

```