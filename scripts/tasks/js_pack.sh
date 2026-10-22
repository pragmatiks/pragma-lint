#!/usr/bin/env bash
set -euo pipefail

pack_destination="$(git rev-parse --show-toplevel)/js"
pack_root=$(mktemp -d)
checkout="$pack_root/checkout"
trap 'git worktree remove --force "$checkout" || true; rm -rf "$pack_root"' EXIT

git worktree add --detach "$checkout" HEAD
node -v
pnpm -v
npm -v
pnpm --dir "$checkout/js" install --frozen-lockfile
MISE_TRUSTED_CONFIG_PATHS="$checkout" mise -C "$checkout" run js:build
npm pack "$checkout/js" --pack-destination "$pack_destination"
