#!/bin/bash
# Wrapper: ruft das Root-Update-Skript auf.
set -e
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec "$ROOT_DIR/update.sh" "$@"
