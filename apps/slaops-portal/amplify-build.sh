#!/bin/bash
set -e

echo "=== Amplify Build Script for slaops-portal ==="

echo "Check NVM exists"
command -v nvm >/dev/null || { export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; }

echo "Using Node 22.x"
nvm install 22
nvm use 22

echo "Installing pnpm globally..."
npm install -g pnpm@8.15.4

echo "Building slaops-portal with Turbo (with caching)..."
cd ../..
pnpm exec turbo run build --filter=vite_react_shadcn_ts

echo "=== Build completed successfully ==="
