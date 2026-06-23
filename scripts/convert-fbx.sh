#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FBX2GLB="${POSEBLOCK_FBX2GLB:-$ROOT/tools/bin/fbx2glb}"

print_usage() {
  cat <<'EOF'
Usage:
  npm run convert:fbx -- <input.fbx> [output-basename]
  bash scripts/convert-fbx.sh <input.fbx> [output-basename]

Converts an FBX file to GLB using tools/bin/fbx2glb.
Output path is the basename without extension; .glb is appended.

Environment:
  POSEBLOCK_FBX2GLB  Override path to fbx2glb binary

Build the converter first:
  cmake -B tools/fbx2.1glb/build -DCMAKE_BUILD_TYPE=Release
  cmake --build tools/fbx2.1glb/build
  mkdir -p tools/bin && cp tools/fbx2.1glb/build/fbx2glb tools/bin/
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  print_usage
  exit 0
fi

INPUT="${1:-}"
if [[ -z "$INPUT" ]]; then
  print_usage
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "Input file not found: $INPUT" >&2
  exit 1
fi

if [[ ! -x "$FBX2GLB" ]]; then
  echo "fbx2glb not found at: $FBX2GLB" >&2
  echo "Build it with:" >&2
  echo "  cmake -B tools/fbx2.1glb/build -DCMAKE_BUILD_TYPE=Release" >&2
  echo "  cmake --build tools/fbx2.1glb/build" >&2
  echo "  mkdir -p tools/bin && cp tools/fbx2.1glb/build/fbx2glb tools/bin/" >&2
  exit 1
fi

OUT="${2:-${INPUT%.fbx}}"
OUT="${OUT%.FBX}"

"$FBX2GLB" -b -v -i "$INPUT" -o "$OUT"
echo "Wrote ${OUT}.glb"
