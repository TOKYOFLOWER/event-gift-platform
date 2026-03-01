#!/usr/bin/env bash
# deploy-admin.sh: shared/ を admin/ にコピーして clasp push & deploy

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."

echo "==> Copying shared/ to src/admin/shared/"
cp -r "$ROOT/src/shared" "$ROOT/src/admin/shared"

echo "==> clasp push (Admin)"
cp "$ROOT/.clasp-admin.json" "$ROOT/.clasp.json"
cd "$ROOT"
clasp push

echo "==> clasp deploy (Admin)"
clasp deploy --description "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "==> Cleaning up copied shared/"
rm -rf "$ROOT/src/admin/shared"

echo "==> Done: Admin WebApp deployed"
