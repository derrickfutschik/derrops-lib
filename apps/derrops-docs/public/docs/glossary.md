---
sidebar_position: 1000
title: Glossary
slug: glossary
description: Glossary of terms used in the project
tags:
  - Glossary
  - Terms
  - Definitions
notes: Turn this into an indexable page for working with AI.
---

# Glossary

Glossary of terms used in the project

TopOperations: The most used operations in the OpenAPI specification based of of logs from clients.

| Short            | Full Name                            | Definition                                                                                                                                                    |
| ---------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OASpec           | OpenAPI Specification                | An [OpenAPI Specification](https://swagger.io/specification/) is a JSON or YAML file that defines the API. It is the contract between the API and the client. |
| TopOp            | Top Operations                       | The most used operations in the OpenAPI specification based of of logs from clients.                                                                          |
| OASpecDoc        | OpenAPI Specification Document       | A document that is created from the OpenAPI specification. It is the document that is indexed into OpenSearch.                                                |
| OASpecTempBucket | OpenAPI Specification Temp S3 Bucket | A temporary bucket that is used to store the OASpec so it can be transferred by the APIUser.                                                                  |
| OASpecBucket     | OpenAPI Specification Bucket         | The source where OpenAPI Specifications are stored.                                                                                                           |
| APIUser          | API User                             | A user that is using the Derrops platform to manage and use their APIs                                                                                         |
