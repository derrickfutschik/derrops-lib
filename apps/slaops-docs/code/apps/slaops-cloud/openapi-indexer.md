# Indexing OpenAPI Specifications

This service is responsible for indexing OpenAPI specifications into OpenSearch.

It can be triggered one of two ways:

1. User Drags in API (Pre-Signed URL -> S3 Staging Bucket)
2. After the upload a user dialog will appear to confirm the API details and the OpenAPI specification, or they can edit the details
3. User will then click the "Save API Button" which will trigger the indexer to parse the specification and index it into OpenSearch.

Optionally there is a bypass button to skip the dialog and directly index the API.

## Requirements

- User must be authenticated
- User cannot override an existing API with it's version without specifying an override flag
- User must have the ability to upload files to the S3 staging bucket
