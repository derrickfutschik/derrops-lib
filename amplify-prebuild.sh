#!/bin/bash
set -e

echo "=== Amplify PreBuild Script for slaops-portal ==="

echo "Check NVM exists"
command -v nvm >/dev/null || { export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; }

echo "Using Node 22.x"
nvm install 22
nvm use 22

echo "Installing pnpm globally..."
npm install -g pnpm@8.15.4

echo "Installing dependencies from monorepo root..."
cd ../..
pnpm install --frozen-lockfile

echo "Building shared packages that slaops-portal depends on..."
pnpm --filter @slaops/core run build
pnpm --filter @slaops/lib run build

echo "Returning to slaops-portal directory..."
cd apps/slaops-portal

echo "=== PreBuild completed successfully ==="
