#!/bin/bash
set -e

echo "=== Amplify Build Script for derrops-portal ==="

# When amplify.yml uses buildPath: '/', cwd is repo root. Otherwise cwd is apps/derrops-portal.
if [ ! -f pnpm-workspace.yaml ]; then
  cd ../..
fi

# Check if we should skip the build. Do not create any artifact and exit non-zero
# so Amplify does not deploy (previous deployment stays live).
if [ -f /tmp/skip-build ]; then
  echo "Skip flag detected: no relevant changes. Exiting without artifact so Amplify will not deploy."
  exit 1
fi

echo "Check NVM exists"
command -v nvm >/dev/null || { export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; }

echo "Using Node 22.x"
nvm install 22
nvm use 22

# Ensure Node heap limit for Vite build (reduces OOM on 16GB Amplify build instances)
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=12000}"

echo "Installing pnpm globally..."
npm install -g pnpm@8.15.4

echo "Building derrops-portal with Turbo (with caching)..."
pnpm exec turbo run build --filter=@derrops/portal

echo "=== Build completed successfully ==="
