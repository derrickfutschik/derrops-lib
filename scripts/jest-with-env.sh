#!/bin/bash
# Wrapper script to run Jest with dotenv-cli
# This ensures we use the Node.js dotenv-cli from node_modules

cd "$(dirname "$0")/.." || exit 1
exec pnpm exec dotenv-cli -e .env -- pnpm exec jest "$@"

