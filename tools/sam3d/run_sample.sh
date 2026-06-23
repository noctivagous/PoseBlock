#!/usr/bin/env bash
# Sample: generate male/adult mannequin GLB via Hugging Face Hub inference.
#
# Prerequisites (one-time):
#   - Hugging Face access to facebook/sam-3d-body-vith + hf auth login
#   - Blender installed (default macOS path below)
#   - sam-3d-body clone (default: ~/Developer/sam-3d-body)
#
# Usage:
#   ./tools/sam3d/run_sample.sh
#   ./tools/sam3d/run_sample.sh --skip-inference   # reuse cached PLY/keypoints

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../" && pwd)"
SAM3D_DIR="$REPO_ROOT/tools/sam3d"
VENV_DIR="$SAM3D_DIR/.venv"

# --- Config (override via env) ---
export SAM3D_BODY_ROOT="${SAM3D_BODY_ROOT:-$HOME/Developer/sam-3d-body}"
BLENDER_BIN="${BLENDER_BIN:-/Applications/Blender.app/Contents/MacOS/Blender}"
HF_REPO="${HF_REPO:-facebook/sam-3d-body-vith}"
DEVICE="${DEVICE:-mps}"   # mps | cpu | cuda
VARIANT="${VARIANT:-male/adult}"

echo "== PoseBlock SAM 3D Body sample =="
echo "  Repo:        $REPO_ROOT"
echo "  SAM3D_BODY:  $SAM3D_BODY_ROOT"
echo "  HF model:    $HF_REPO (weights from Hub, not local checkpoints)"
echo "  Variant:     $VARIANT"
echo "  Device:      $DEVICE"
echo ""

# --- Checks ---
if [[ ! -d "$SAM3D_BODY_ROOT/sam_3d_body" ]]; then
  echo "ERROR: sam-3d-body not found at $SAM3D_BODY_ROOT"
  echo "  git clone https://github.com/facebookresearch/sam-3d-body \"$SAM3D_BODY_ROOT\""
  exit 1
fi

if [[ ! -x "$BLENDER_BIN" ]]; then
  echo "ERROR: Blender not found at $BLENDER_BIN"
  echo "  Set BLENDER_BIN=/path/to/blender"
  exit 1
fi

if [[ ! -f "$REPO_ROOT/tools/bin/fbx2glb" ]]; then
  echo "ERROR: fbx2glb not found at tools/bin/fbx2glb"
  exit 1
fi

IMG="$SAM3D_DIR/model-images/mannequins/${VARIANT}/standard/front.png"
if [[ ! -f "$IMG" ]]; then
  echo "ERROR: Input image not found: $IMG"
  echo "  model-images/ is gitignored — place mannequin PNGs locally."
  exit 1
fi

# --- Python venv (PyTorch requires Python 3.11–3.12; not 3.13) ---
find_python312() {
  if command -v uv &>/dev/null; then
  if uv python find 3.12 &>/dev/null; then
      return 0
    fi
  fi
  for p in \
    /usr/local/opt/python@3.12/bin/python3.12 \
    /opt/homebrew/opt/python@3.12/bin/python3.12 \
    "$HOME/.local/share/uv/python/"*/bin/python3.12; do
    if [[ -x "$p" ]]; then
      echo "$p"
      return 0
    fi
  done
  return 1
}

if command -v uv &>/dev/null && uv python find 3.12 &>/dev/null; then
  echo "Creating venv with uv (Python 3.12) ..."
  uv venv "$VENV_DIR" --python 3.12
  # shellcheck source=/dev/null
  source "$VENV_DIR/bin/activate"
  echo "Installing Python dependencies (may take a while on first run) ..."
  uv pip install -r "$SAM3D_DIR/requirements.txt"
  uv pip install -r "$SAM3D_DIR/requirements-sam3d-body-minimal.txt"
elif PY312="$(find_python312)"; then
  echo "Creating venv with $PY312 ..."
  "$PY312" -m venv "$VENV_DIR"
  # shellcheck source=/dev/null
  source "$VENV_DIR/bin/activate"
  echo "Installing Python dependencies (may take a while on first run) ..."
  pip install -q --upgrade pip
  pip install -q -r "$SAM3D_DIR/requirements.txt"
  pip install -q -r "$SAM3D_DIR/requirements-sam3d-body-minimal.txt"
else
  echo "ERROR: Need Python 3.12 for PyTorch (3.13 is not supported yet)."
  echo "  Install: brew install python@3.12"
  echo "  Or install uv: https://docs.astral.sh/uv/  (then re-run this script)"
  exit 1
fi

# --- Patch sam-3d-body for Mac MPS/CPU (replaces hardcoded cuda) ---
python3 "$SAM3D_DIR/patch_sam3d_body.py" "$SAM3D_BODY_ROOT"

# --- Run pipeline ---
cd "$REPO_ROOT"
export PYTHONPATH="${SAM3D_BODY_ROOT}${PYTHONPATH:+:$PYTHONPATH}"

python3 "$SAM3D_DIR/generate_mannequins.py" \
  --variants "$VARIANT" \
  --hf-repo "$HF_REPO" \
  --blender "$BLENDER_BIN" \
  --device "$DEVICE" \
  "$@"

OUT_GLB="$REPO_ROOT/public/models/mannequins/${VARIANT}/mannequin.glb"
if [[ -f "$OUT_GLB" ]]; then
  echo ""
  echo "Success: $OUT_GLB"
  ls -lh "$OUT_GLB"
else
  echo "Pipeline finished but expected output missing: $OUT_GLB"
  exit 1
fi
