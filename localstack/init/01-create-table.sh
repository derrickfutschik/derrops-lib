#!/usr/bin/env bash
set -euo pipefail

echo "[init] Creating DynamoDB table 'server-index' in LocalStack..."

awslocal dynamodb create-table \
  --table-name server-index \
  --attribute-definitions \
    AttributeName=host_template,AttributeType=S \
    AttributeName=base_path,AttributeType=S \
  --key-schema \
    AttributeName=host_template,KeyType=HASH \
    AttributeName=base_path,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST || {

  echo "[init] Table 'server-index' may already exist, ignoring error."
}

echo "[init] Done."