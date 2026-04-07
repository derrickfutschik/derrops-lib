---
title: OpenAPI Indexer Module
slug: openapi-indexer
description: OpenAPI Indexer Module
tags:
  - OpenAPI
  - Indexer
---

# OpenAPI Indexer Module

This modules is responsible for indexing OpenAPI specifications (OASpec).

## Sources

There are a number of different sources for an OASpec:

- `S3URI` Location of the specification
- Publicly accessible `URL`
- Direct JSON body of the OASpec
- Direct YAML body of the OASpec

## Flow

Whatever the source of the OASpec, it will go through the following flow:

```mermaid
flowchart LR

    S[Source]
    I[OpenAPI Indexer]
    OAS[OASpec S3 Bucket]
    OS[OpenSearch]

    S --> I
    I -->|OASpec| OAS
    I -->|OASpec Document| OS

```

### Upload Flow

The OpenAPI Indexer can generate a pre-signed URL for the user to upload the OASpec to the OASPec Temp Bucket.

OASPec Temp Bucket is a temporary bucket that is used to store the OASpec so it can be transferred by the APIUser. The OpenAPI Indexer can then read the OASpec from the Temp Bucket, validate it, transform it into an OpenSearch document and index it into OpenSearch, as well as copying the OASpec to the OASpec Bucket.

1. The source is provided to the OpenAPI Indexer
2. The `OpenAPI Indexer` will parse the OASpec and validate it
3. The `OpenAPI Indexer` will transform the OASpec into an OpenSearch document
4. The `OpenAPI Indexer` will index the document into OpenSearch
5. The `OpenAPI Indexer` will return the document

## Sequence Diagram

```mermaid
sequenceDiagram
    participant C as Client
    participant I as OpenAPI Indexer
    participant S3T as OASpec Temp Bucket
    participant S3 as OASpec Bucket
    participant OS as OpenSearch

    C->>I: Request pre-signed upload URL
    I-->>C: Pre-signed URL

    C->>S3T: Upload OASpec (via pre-signed URL) ${uuidv1()}/spec.[yaml|json]

    C->>I: Trigger indexing (S3 URI / URL / JSON / YAML)
    I->>S3T: Fetch OASpec
    S3T-->>I: OASpec content

    I->>I: Parse & validate OASpec
    I->>I: Transform into OpenSearch document

    I->>S3: Copy OASpec s3://APIs/{provider}/{service}/{version}/openapi.{yaml|json}
    I->>OS: Index document

    I-->>C: Return indexed document
```
