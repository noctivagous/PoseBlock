#!/usr/bin/env bash
# Automated checks for PoseBlock (Veo validation is manual — see docs/VEO-TEST.md)
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> npm run lint"
npm run lint

echo "==> npm run build"
npm run build

echo "==> Checking required files"
for f in \
  public/models/xbot_mixamo.glb \
  public/models/ybot_mixamo.glb \
  public/models/teen_f_mixamo.glb \
  public/default_backdrop.jpg \
  lib/poses.ts \
  scripts/generate_character.py \
  scripts/blender/retarget_mhr_to_mixamo.py \
  docs/CHARACTER-PIPELINE.md \
  docs/VEO-TEST.md
do
  test -f "$f" || { echo "Missing: $f"; exit 1; }
  echo "  ok $f"
done

echo "==> Export helper present"
grep -q 'toDataURL' components/ExportButton.tsx

echo ""
echo "All automated checks passed."
echo "Manual: npm run dev → pose → Export for Veo → follow docs/VEO-TEST.md"
