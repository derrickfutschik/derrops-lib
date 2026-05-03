# Environment Setup

- It may be good to get this going once and for all, as at the moment, it is painful to build and deploy.
- Consider saving money on amplify

Need to set this up
localhost -> local
dev.derrops.com -> local ??
lovable -> server
app.derrops.com -> server

# OpenAPI Indexing

## Indexing

- Optional Icon (auto-generate using AI)
- Controller to index OpenAPIs for SaaS providers
- GUI with drag and top open api specs
- GUI which can take an open api url, (setup auto-updating to be done later)
- Enable versioning on the s3 bucket for overriding existing APIs
- Prefix for each tenant (global managed by derrops)

## Searching

- Quick search component for quickly adding SAAS provider to monitor
- Search by description, domain, server, operations, paths, tags
- Find API by domain, server, path, etc

## Lookup

- Quick lookups of request base of the domain shape, and url shape something.$.com/users/{string}/world
- Make sure AWS S3 works

## Ability to re-index what is in the bucket

Be able to re-index what was in the s3 bucket so if the indexing strategy changes, there are no issues
Do this with aliases so it is easy to have no downtime indexing and searching

## Convert

Convert Swagger 2.0 to OpenAPI 3.1.0 when indexing into aws s3
