#!/usr/bin/env bash
set -euo pipefail

rm -rf data
mkdir -p data
cp config.yaml.example data/config.yaml

docker compose up -d --build
trap 'docker compose down' EXIT

for _ in {1..30}; do
  if curl -fs http://localhost/api/health >/dev/null; then
    curl -fs http://localhost/api/health
    exit 0
  fi
  sleep 1
done

docker compose logs app
exit 1
