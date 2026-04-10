#!/usr/bin/env bash
# Run the existing dev-8080-local tunnel (defined in ~/.cloudflared/config.yml).
# Tunnel 5fe12326-7488-421a-b29f-62222aa0388c → dev.dersza.com + imac.dersza.com → localhost:8080
#
# One-time setup (already done — do NOT re-run these):
#   cloudflared tunnel create dev-8080-local
#   cloudflared tunnel route dns dev-8080-local dev.dersza.com
#   cloudflared tunnel route dns dev-8080-local imac.dersza.com

set -euo pipefail

cloudflared tunnel run dev-8080-local
