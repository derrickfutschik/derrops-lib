#!/bin/bash
set -e

echo "=== Amplify PreBuild Script for slaops-docs ==="

echo "Using Node 22.x"
nvm install 22
nvm use 22

echo "Installing pnpm globally..."
npm install -g pnpm@8.15.4

echo "Installing dependencies from monorepo root..."
cd ../..
pnpm install --frozen-lockfile

echo "Building shared packages that slaops-docs depends on..."
pnpm --filter @slaops/core run build
pnpm --filter @slaops/lib run build

echo "Returning to slaops-docs directory..."
cd apps/slaops-docs

echo "=== PreBuild completed successfully ==="
