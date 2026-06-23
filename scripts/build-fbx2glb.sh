#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/tools/fbx2.1glb"
BUILD="$SRC/build"
BIN="$ROOT/tools/bin/fbx2glb"

if [[ ! -d "$SRC" ]]; then
  echo "Missing submodule at tools/fbx2.1glb" >&2
  echo "Run: git submodule update --init --recursive" >&2
  exit 1
fi

cmake -B "$BUILD" -DCMAKE_BUILD_TYPE=Release
cmake --build "$BUILD"

mkdir -p "$(dirname "$BIN")"
cp "$BUILD/fbx2glb" "$BIN"
chmod +x "$BIN"

echo "Installed $BIN"
