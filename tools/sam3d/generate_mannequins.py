#!/usr/bin/env python3
"""
SAM 3D Body mannequin generation pipeline for PoseBlock.

For each of the six mannequin variants (female/adult, female/child, female/teen,
male/adult, male/child, male/teen), this script:

  1. Runs SAM 3D Body (facebook/sam-3d-body-vith) on the front-view PNG.
     Model weights are loaded from Hugging Face Hub on first run (cached under
     ~/.cache/huggingface). No local checkpoint download is required.
  2. Saves the raw PLY mesh and MHR70 keypoints JSON to tools/sam3d/output/.
  3. Invokes Blender in headless mode to build a Mixamo armature from the
     keypoints, bind the mesh with automatic weights, and export an FBX.
  4. Converts the FBX to GLB using tools/bin/fbx2glb.
  5. Copies the final GLB to public/models/mannequins/<gender>/<age>/mannequin.glb.

Usage:
  python generate_mannequins.py [--blender /path/to/blender] [--device cuda]

Skip flags (for re-running partial pipeline):
  --skip-inference   Use cached PLY/keypoints from a previous run
  --skip-blender     Use a cached FBX from a previous run

See tools/sam3d/README.md for full setup instructions.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional, Tuple

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT    = Path(__file__).resolve().parents[2]
TOOLS_DIR    = REPO_ROOT / "tools"
SAM3D_DIR    = TOOLS_DIR / "sam3d"
MODEL_IMAGES = SAM3D_DIR / "model-images" / "mannequins"
OUTPUT_DIR   = SAM3D_DIR / "output"
PUBLIC_MODELS = REPO_ROOT / "public" / "models" / "mannequins"
FBX2GLB      = TOOLS_DIR / "bin" / "fbx2glb"
BLENDER_SCRIPT = SAM3D_DIR / "blender_rig_export.py"

VARIANTS = [
    ("female", "adult"),
    ("female", "child"),
    ("female", "teen"),
    ("male",   "adult"),
    ("male",   "child"),
    ("male",   "teen"),
]

# Primary view used for single-image inference.
# Front-facing images give the best body pose estimates.
PRIMARY_VIEW = "front.png"

LIGHT_BLUE = (0.65098039, 0.74117647, 0.85882353)


def _save_qc_overlay(img_bgr, person_output, faces, dest: Path) -> None:
    """Mesh overlay QC image without importing detectron2-dependent vis utils."""
    import cv2
    import numpy as np
    from sam_3d_body.visualization.renderer import Renderer

    renderer = Renderer(focal_length=person_output["focal_length"], faces=faces)
    rend = renderer(
        person_output["pred_vertices"],
        person_output["pred_cam_t"],
        img_bgr.copy(),
        mesh_base_color=LIGHT_BLUE,
        scene_bg_color=(1, 1, 1),
    )
    cv2.imwrite(str(dest), (rend * 255).astype(np.uint8))

# ---------------------------------------------------------------------------
# Step 1 — SAM 3D Body inference
# ---------------------------------------------------------------------------

def _resolve_device(device: Optional[str] = None) -> str:
    import torch

    if device is not None:
        return device
    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def _verify_hf_hub_access(repo_id: str) -> None:
    """Confirm gated-model access before downloading weights from the Hub."""
    from huggingface_hub import HfApi
    from huggingface_hub.utils import GatedRepoError, HfHubHTTPError

    api = HfApi()
    try:
        api.model_info(repo_id)
    except GatedRepoError:
        print(
            f"[ERROR] Gated model {repo_id!r}: request access on Hugging Face, "
            f"then run: hf auth login"
        )
        sys.exit(1)
    except HfHubHTTPError as exc:
        print(f"[ERROR] Could not reach Hugging Face Hub for {repo_id!r}: {exc}")
        sys.exit(1)


def setup_estimator(hf_repo_id: str, device: Optional[str] = None):
    """
    Load SAM 3D Body from Hugging Face Hub (not local checkpoints).

    Weights are fetched via huggingface_hub.snapshot_download and cached in the
  standard HF cache (~/.cache/huggingface). Requires the sam-3d-body Python
    package on PYTHONPATH (see SAM3D_BODY_ROOT / tools/sam3d/README.md).
    """
    _ensure_sam3d_body_on_path()
    _verify_hf_hub_access(hf_repo_id)

    from sam_3d_body import load_sam_3d_body_hf, SAM3DBodyEstimator

    device = _resolve_device(device)
    print(
        f"Loading SAM 3D Body from Hugging Face Hub: {hf_repo_id!r} "
        f"(device={device})"
    )
    print("  Weights download on first run; cached by huggingface_hub afterward.")

    # HuggingFace Hub → model.ckpt + assets/mhr_model.pt (see build_models.py)
    model, model_cfg = load_sam_3d_body_hf(hf_repo_id, device=device)

    # Full-frame mannequin PNGs — no ViTDet / MoGe / SAM2 optional modules.
    return SAM3DBodyEstimator(
        sam_3d_body_model=model,
        model_cfg=model_cfg,
        human_detector=None,
        human_segmentor=None,
        fov_estimator=None,
    )


def _ensure_sam3d_body_on_path() -> None:
    """Add facebook/sam-3d-body clone to sys.path (see tools/sam3d/env.sh)."""
    root = os.environ.get("SAM3D_BODY_ROOT")
    if not root:
        default = Path.home() / "Developer" / "sam-3d-body"
        if default.is_dir():
            root = str(default)
    if root and root not in sys.path:
        sys.path.insert(0, root)


def run_inference(
    estimator,
    gender: str,
    age: str,
    out_dir: Path,
) -> Optional[Tuple[Path, Path]]:
    """
    Run SAM 3D Body on the front-view image for one mannequin variant.

    Returns (ply_path, kpts_path) or None if detection failed.
    """
    img_path = MODEL_IMAGES / gender / age / "standard" / PRIMARY_VIEW
    if not img_path.exists():
        print(f"  [SKIP] Image not found: {img_path}")
        return None

    out_dir.mkdir(parents=True, exist_ok=True)

    import cv2
    import numpy as np

    img_bgr = cv2.imread(str(img_path))
    if img_bgr is None:
        print(f"  [ERROR] Could not read image: {img_path}")
        return None
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

    print(f"  Inference on {img_path.relative_to(REPO_ROOT)} ...")
    outputs = estimator.process_one_image(img_rgb)

    if not outputs:
        print(f"  [WARN] No person detected in {img_path.name}")
        return None

    # Use the first (and typically only) detected person
    person = outputs[0]

    # --- Save PLY mesh ---
    from sam_3d_body.visualization.renderer import Renderer

    LIGHT_BLUE = (0.65098039, 0.74117647, 0.85882353)
    renderer = Renderer(focal_length=person["focal_length"], faces=estimator.faces)
    tmesh = renderer.vertices_to_trimesh(
        person["pred_vertices"], person["pred_cam_t"], LIGHT_BLUE
    )
    ply_path = out_dir / "mesh.ply"
    tmesh.export(str(ply_path))

    # --- Save MHR70 keypoints ---
    kpts = person["pred_keypoints_3d"]
    if hasattr(kpts, "tolist"):
        kpts = kpts.tolist()
    kpts_path = out_dir / "keypoints_mhr70.json"
    with open(kpts_path, "w") as f:
        json.dump({"keypoints_3d": kpts}, f, indent=2)

    # --- Save full MHR params for reference ---
    def _to_list(v):
        return v.tolist() if hasattr(v, "tolist") else v

    params = {
        "body_pose_params": _to_list(person.get("body_pose_params", [])),
        "hand_pose_params": _to_list(person.get("hand_pose_params", [])),
        "shape_params":     _to_list(person.get("shape_params", [])),
        "pred_cam_t":       _to_list(person["pred_cam_t"]),
        "focal_length":     float(person["focal_length"]),
        "bbox":             _to_list(person.get("bbox", [])),
    }
    with open(out_dir / "mhr_params.json", "w") as f:
        json.dump(params, f, indent=2)

    # --- Save overlay visualization for visual QC (Renderer only — no detectron2) ---
    _save_qc_overlay(img_bgr, person, estimator.faces, out_dir / "qc_overlay.jpg")

    print(f"  Saved PLY, keypoints, params, QC overlay → {out_dir.relative_to(REPO_ROOT)}/")
    return ply_path, kpts_path


# ---------------------------------------------------------------------------
# Step 2 — Blender: build Mixamo rig + export FBX
# ---------------------------------------------------------------------------

def run_blender_rigging(
    ply_path: Path,
    kpts_path: Path,
    fbx_path: Path,
    blender_bin: str,
) -> bool:
    """Call Blender headless to rig the mesh and export FBX."""
    cmd = [
        blender_bin,
        "--background",
        "--python", str(BLENDER_SCRIPT),
        "--",
        "--ply",       str(ply_path),
        "--keypoints", str(kpts_path),
        "--output",    str(fbx_path),
    ]
    print(f"  Blender rigging → {fbx_path.name} ...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  [ERROR] Blender exited {result.returncode}")
        # Show last 3000 chars of stderr to avoid flooding the terminal
        tail = (result.stderr or result.stdout or "")[-3000:]
        print(f"  --- Blender stderr (tail) ---\n{tail}")
        return False
    # Surface any [blender_rig_export] lines from stdout
    for line in result.stdout.splitlines():
        if "blender_rig_export" in line or "Error" in line:
            print(f"    {line}")
    return True


# ---------------------------------------------------------------------------
# Step 3 — fbx2glb: FBX → GLB
# ---------------------------------------------------------------------------

def run_fbx2glb(fbx_path: Path, glb_path: Path) -> bool:
    """Convert FBX to GLB using the bundled fbx2glb binary."""
    if not FBX2GLB.exists():
        print(f"  [ERROR] fbx2glb not found at {FBX2GLB}")
        return False

    cmd = [str(FBX2GLB), str(fbx_path), "--output", str(glb_path)]
    print(f"  fbx2glb: {fbx_path.name} → {glb_path.name} ...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  [ERROR] fbx2glb failed:\n{result.stderr or result.stdout}")
        return False
    return True


# ---------------------------------------------------------------------------
# Step 4 — deploy to public/models
# ---------------------------------------------------------------------------

def deploy_glb(glb_path: Path, gender: str, age: str) -> None:
    dest_dir = PUBLIC_MODELS / gender / age
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / "mannequin.glb"
    shutil.copy2(glb_path, dest)
    print(f"  Deployed → {dest.relative_to(REPO_ROOT)}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate Mixamo-rigged GLB mannequins via SAM 3D Body",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--hf-repo",
        default="facebook/sam-3d-body-vith",
        help="HuggingFace repo ID (default: facebook/sam-3d-body-vith)",
    )
    parser.add_argument(
        "--blender",
        default="blender",
        help="Path to Blender 3.x/4.x executable (default: 'blender' in PATH)",
    )
    parser.add_argument(
        "--device",
        default=None,
        help="PyTorch device override (e.g. 'cuda', 'cpu', 'mps')",
    )
    parser.add_argument(
        "--variants",
        nargs="+",
        metavar="GENDER/AGE",
        default=None,
        help="Subset of variants to process, e.g. --variants female/adult male/teen",
    )
    parser.add_argument(
        "--skip-inference",
        action="store_true",
        help="Skip SAM 3D Body inference; use cached PLY/keypoints in output/",
    )
    parser.add_argument(
        "--skip-blender",
        action="store_true",
        help="Skip Blender rigging step; use cached FBX in output/",
    )
    parser.add_argument(
        "--no-deploy",
        action="store_true",
        help="Do not copy final GLBs to public/models/mannequins/",
    )
    args = parser.parse_args()

    # Resolve requested variants
    variants = VARIANTS
    if args.variants:
        requested = set()
        for v in args.variants:
            parts = v.split("/")
            if len(parts) == 2:
                requested.add((parts[0], parts[1]))
        variants = [(g, a) for g, a in VARIANTS if (g, a) in requested]
        if not variants:
            print(f"[ERROR] No valid variants matched: {args.variants}")
            sys.exit(1)

    # Load model once (unless skipping inference)
    estimator = None
    if not args.skip_inference:
        estimator = setup_estimator(args.hf_repo, args.device)

    success_count = 0
    fail_count = 0

    for gender, age in variants:
        label = f"{gender}/{age}"
        print(f"\n{'='*50}")
        print(f"  Variant: {label}")
        print(f"{'='*50}")

        out_dir   = OUTPUT_DIR / gender / age
        fbx_path  = out_dir / "mannequin.fbx"
        glb_path  = out_dir / "mannequin.glb"

        # ---- Step 1: Inference ----
        if args.skip_inference:
            ply_path  = out_dir / "mesh.ply"
            kpts_path = out_dir / "keypoints_mhr70.json"
            if not ply_path.exists() or not kpts_path.exists():
                print(f"  [SKIP] Cached outputs not found for {label}")
                fail_count += 1
                continue
            print(f"  Using cached PLY/keypoints in {out_dir.relative_to(REPO_ROOT)}/")
        else:
            result = run_inference(estimator, gender, age, out_dir)
            if result is None:
                fail_count += 1
                continue
            ply_path, kpts_path = result

        # ---- Step 2: Blender rigging → FBX ----
        if args.skip_blender:
            if not fbx_path.exists():
                print(f"  [SKIP] Cached FBX not found: {fbx_path}")
                fail_count += 1
                continue
            print(f"  Using cached FBX: {fbx_path.name}")
        else:
            ok = run_blender_rigging(ply_path, kpts_path, fbx_path, args.blender)
            if not ok:
                fail_count += 1
                continue

        # ---- Step 3: FBX → GLB ----
        ok = run_fbx2glb(fbx_path, glb_path)
        if not ok:
            fail_count += 1
            continue

        # ---- Step 4: Deploy ----
        if not args.no_deploy:
            deploy_glb(glb_path, gender, age)

        success_count += 1

    print(f"\n{'='*50}")
    print(f"  Complete: {success_count} succeeded, {fail_count} failed")
    print(f"{'='*50}")

    if fail_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
