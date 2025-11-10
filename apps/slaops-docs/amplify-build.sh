#!/bin/bash
set -e

echo "=== Amplify Build Script for slaops-docs ==="

echo "Check NVM exists"
command -v nvm >/dev/null || { export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; }

echo "Using Node 22.x"
nvm install 22
nvm use 22

echo "Installing pnpm globally..."
npm install -g pnpm@8.15.4

echo "Building shared packages that slaops-docs depends on..."
cd ../..
pnpm --filter @slaops/core run build
pnpm --filter @slaops/lib run build

echo "Returning to slaops-docs directory..."
cd apps/slaops-docs

echo "=== PreBuild completed successfully ==="

echo "Building slaops-docs..."
pnpm run build

echo "=== Build completed successfully ==="
