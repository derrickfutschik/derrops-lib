#!/usr/bin/env bash
set -euo pipefail

echo "[init] Creating DynamoDB table 'Movies' in LocalStack..."

awslocal dynamodb create-table \
  --table-name Movies \
  --attribute-definitions AttributeName=MovieId,AttributeType=S \
  --key-schema AttributeName=MovieId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST || {

  echo "[init] Table 'Movies' may already exist, ignoring error."
}

echo "[init] Done."