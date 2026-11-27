#!/usr/bin/env bash
set -euo pipefail

if curl -fsS http://127.0.0.1:5173/ >/dev/null 2>&1; then
  exit 0
fi

exec node tools/serve.mjs 5173
