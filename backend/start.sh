#!/usr/bin/env bash
set -euo pipefail

python -m prisma py fetch
python -m prisma db push --skip-generate
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
