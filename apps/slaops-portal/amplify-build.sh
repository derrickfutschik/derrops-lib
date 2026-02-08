#!/bin/bash
set -e

echo "=== Amplify Build Script for slaops-portal ==="

# When amplify.yml uses buildPath: '/', cwd is repo root. Otherwise cwd is apps/slaops-portal.
if [ ! -f pnpm-workspace.yaml ]; then
  cd ../..
fi

# Check if we should skip the build (after cd so we can create dist in the right place)
if [ -f /tmp/skip-build ]; then
  echo "Skip flag detected, creating minimal artifact under dist/ for Amplify"
  if [ -f pnpm-workspace.yaml ]; then
    skip_dir=apps/slaops-portal/dist
  else
    skip_dir=dist
  fi
  mkdir -p "$skip_dir"
  echo "<!DOCTYPE html><html><body>Build skipped - no relevant changes</body></html>" > "$skip_dir/index.html"
  exit 0
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

echo "Building slaops-portal with Turbo (with caching)..."
pnpm exec turbo run build --filter=@slaops/portal

echo "=== Build completed successfully ==="
