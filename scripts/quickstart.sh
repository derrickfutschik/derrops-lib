#!/bin/bash
# Start the Derrops dev environment via tmuxinator.
# Run from the repo root: ./scripts/quickstart.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="$ROOT_DIR/.tmuxinator.env"
TMUX_CONFIG="$ROOT_DIR/.tmuxinator.yml"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found."
  exit 1
fi

# shellcheck source=../.tmuxinator.env
source "$ENV_FILE"

tmuxinator start -p "$TMUX_CONFIG"
