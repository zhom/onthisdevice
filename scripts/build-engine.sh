#!/bin/sh
# Builds src/lib/engine/engine.wasm from rust/. The prefix map keeps machine paths out of the
# binary, so the same source gives the same bytes on every machine, and CI can compare them.
set -e
cd "$(dirname "$0")/../rust"
RUSTFLAGS="--remap-path-prefix=$HOME/.cargo=/cargo" cargo build --release --locked --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/engine.wasm ../src/lib/engine/engine.wasm
