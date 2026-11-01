#!/bin/sh
# One full build at a time on this machine: waits for the lock, then runs `npm run build`.
# Usage: sh scripts/locked-build.sh
LOCK=scripts/.tmp/build.lock
mkdir -p scripts/.tmp
while ! mkdir "$LOCK" 2>/dev/null; do sleep 5; done
trap 'rmdir "$LOCK"' EXIT INT TERM
npm run build
