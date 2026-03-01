#!/usr/bin/env bash
# deploy-public.sh: shared/ を public/ にコピーして clasp push & deploy

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."

echo "==> Copying shared/ to src/public/shared/"
cp -r "$ROOT/src/shared" "$ROOT/src/public/shared"

echo "==> clasp push (Public)"
cp "$ROOT/.clasp-public.json" "$ROOT/.clasp.json"
cd "$ROOT"
clasp push

echo "==> clasp deploy (Public)"
clasp deploy --description "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "==> Cleaning up copied shared/"
rm -rf "$ROOT/src/public/shared"

echo "==> Done: Public WebApp deployed"
