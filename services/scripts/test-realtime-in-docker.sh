#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../elixir/realtime"
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp/home -e MIX_HOME=/tmp/home/.mix -e HEX_HOME=/tmp/home/.hex -e MIX_ENV=test \
  -v "$PWD:/work" -w /work elixir:1.20.5 \
  bash -c 'mkdir -p /tmp/home && mix local.hex --force >/dev/null && mix local.rebar --force >/dev/null && mix deps.get && mix format --check-formatted && mix compile --warnings-as-errors && mix test'
