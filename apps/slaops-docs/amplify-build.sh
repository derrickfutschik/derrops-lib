#!/bin/bash
set -e

echo "=== Amplify Build Script for slaops-docs ==="

echo "Building slaops-docs..."
pnpm run build

echo "=== Build completed successfully ==="
