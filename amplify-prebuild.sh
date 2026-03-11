#!/bin/bash
set -e

echo "=== Amplify PreBuild Script for slaops-portal ==="

# Check if we should skip the build
if [ -f /tmp/skip-build ]; then
  echo "Skip flag detected, exiting prebuild early"
  exit 0
fi

# When amplify.yml uses buildPath: '/', cwd is repo root. Otherwise cwd is apps/slaops-portal.
if [ ! -f pnpm-workspace.yaml ]; then
  echo "Working from app dir, changing to monorepo root..."
  cd ../..
fi

echo "Check NVM exists"
command -v nvm >/dev/null || { export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; }

echo "Using Node 22.x"
nvm install 22
nvm use 22

echo "Installing pnpm globally..."
npm install -g pnpm@8.15.4

# Use store under repo root so Amplify cache (buildPath: /) restores it
pnpm config set store-dir .pnpm-store

echo "Installing dependencies from monorepo root..."
pnpm install --frozen-lockfile

echo "Installing Turbo globally for caching benefits..."
npm install -g turbo@2.6.1

echo "Building shared packages with Turbo (with caching)..."
pnpm exec turbo run build --filter=@slaops/private --filter=@slaops/public

echo "=== PreBuild completed successfully ==="
