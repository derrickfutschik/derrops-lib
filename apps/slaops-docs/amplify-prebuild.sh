#!/bin/bash
set -e

echo "=== Amplify PreBuild Script for slaops-docs ==="

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

echo "Installing Turbo globally for caching benefits..."
npm install -g turbo@2.6.1

echo "Building shared packages with Turbo (with caching)..."
pnpm exec turbo run build --filter=@slaops/private --filter=@slaops/public

echo "Returning to slaops-docs directory..."
cd apps/slaops-docs

echo "=== PreBuild completed successfully ==="
