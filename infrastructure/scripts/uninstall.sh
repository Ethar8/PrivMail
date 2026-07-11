#!/bin/bash
# Wrapper: ruft das Root-Deinstallations-Skript auf.
set -e
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec "$ROOT_DIR/uninstall.sh" "$@"
