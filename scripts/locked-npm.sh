#!/bin/sh
# One npm install at a time in this checkout (agents share node_modules and package.json).
# Usage: sh scripts/locked-npm.sh install <pkg>...
LOCK=scripts/.tmp/npm.lock
mkdir -p scripts/.tmp
while ! mkdir "$LOCK" 2>/dev/null; do sleep 3; done
trap 'rmdir "$LOCK"' EXIT INT TERM
npm "$@"
