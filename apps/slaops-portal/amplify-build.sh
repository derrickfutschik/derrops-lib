#!/bin/bash
set -e

echo "=== Amplify Build Script for slaops-portal ==="

# Check if we should skip the build
if [ -f /tmp/skip-build ]; then
  echo "Skip flag detected, creating empty dist to satisfy Amplify"
  mkdir -p ../../dist
  echo "<html><body>Build skipped - no changes detected</body></html>" > ../../dist/index.html
  exit 0
fi

echo "Check NVM exists"
command -v nvm >/dev/null || { export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; }

echo "Using Node 22.x"
nvm install 22
nvm use 22

echo "Installing pnpm globally..."
npm install -g pnpm@8.15.4

echo "Building slaops-portal with Turbo (with caching)..."
cd ../..
pnpm exec turbo run build --filter=@slaops/portal

echo "=== Build completed successfully ==="
