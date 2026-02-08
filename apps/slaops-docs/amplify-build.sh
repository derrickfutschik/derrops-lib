#!/bin/bash
set -e

echo "=== Amplify Build Script for slaops-docs ==="

# When amplify.yml uses buildPath: '/', cwd is repo root. Otherwise cwd is apps/slaops-docs.
if [ ! -f pnpm-workspace.yaml ]; then
  cd ../..
fi

echo "Check NVM exists"
command -v nvm >/dev/null || { export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; }

echo "Using Node 22.x"
nvm install 22
nvm use 22

echo "Installing pnpm globally..."
npm install -g pnpm@8.15.4

echo "Building slaops-docs with Turbo (with caching)..."
pnpm exec turbo run build --filter=@slaops/docs

echo "=== Build completed successfully ==="
