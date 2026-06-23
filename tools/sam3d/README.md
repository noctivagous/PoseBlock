# SAM 3D Body → Mixamo GLB Pipeline

Generates Mixamo-rigged `.glb` mannequin models from the reference images in
`model-images/mannequins/` using Meta's [SAM 3D Body](https://github.com/facebookresearch/sam-3d-body)
and the bundled `fbx2glb` converter.

**Variants produced** (six total):

| Gender | Age   | Output GLB |
|--------|-------|-----------|
| female | adult | `public/models/mannequins/female/adult/mannequin.glb` |
| female | child | `public/models/mannequins/female/child/mannequin.glb` |
| female | teen  | `public/models/mannequins/female/teen/mannequin.glb`  |
| male   | adult | `public/models/mannequins/male/adult/mannequin.glb`   |
| male   | child | `public/models/mannequins/male/child/mannequin.glb`   |
| male   | teen  | `public/models/mannequins/male/teen/mannequin.glb`    |

---

## Pipeline overview

```
front.png
    │
    ▼ Step 1 — SAM 3D Body inference
mesh.ply  +  keypoints_mhr70.json  +  mhr_params.json
    │
    ▼ Step 2 — Blender headless (blender_rig_export.py)
        • Build Mixamo armature from MHR70 keypoints
        • Bind mesh with Automatic Weights
mannequin.fbx
    │
    ▼ Step 3 — fbx2glb  (tools/bin/fbx2glb)
mannequin.glb
    │
    ▼ Step 4 — deploy
public/models/mannequins/<gender>/<age>/mannequin.glb
```

---

## Prerequisites

### 1. Hugging Face Hub (model weights)

Inference loads **model weights from Hugging Face Hub**, not from files in this
repo. On first run, `load_sam_3d_body_hf()` downloads `model.ckpt` and
`assets/mhr_model.pt` from the Hub and caches them (typically under
`~/.cache/huggingface`). You do **not** need `hf download` into
`tools/sam3d/checkpoints/`.

Request gated access at:
<https://huggingface.co/facebook/sam-3d-body-vith>

Then authenticate once:

```bash
hf auth login
```

### 2. SAM 3D Body Python package (inference code, not weights)

The Hub provides weights only. You still need the **sam-3d-body source** on
`PYTHONPATH` for the estimator and renderer:

```bash
git clone https://github.com/facebookresearch/sam-3d-body
export SAM3D_BODY_ROOT="$HOME/Developer/sam-3d-body"   # adjust path
python tools/sam3d/patch_sam3d_body.py "$SAM3D_BODY_ROOT"   # Mac MPS/CPU fix
```

On Mac, patch the hardcoded `cuda` line before first inference (see
`patch_sam3d_body.py`).

### 3. Install Python dependencies

```bash
pip install -r tools/sam3d/requirements.txt
pip install -r tools/sam3d/requirements-sam3d-body-minimal.txt
```

Optional heavy modules (ViTDet, MoGe, SAM2) are **not** required — mannequin
images use the full frame with no detector.

### 4. Blender 3.x or 4.x

Download from <https://www.blender.org/download/> and make the `blender`
executable available in your `PATH`, or pass `--blender /full/path/to/blender`
when running the script.

### 5. fbx2glb (already built)

The converter is pre-built at `tools/bin/fbx2glb`. If it needs to be rebuilt:

```bash
cd tools/fbx2.1glb
cmake -B build && cmake --build build --parallel
cp build/fbx2glb ../bin/fbx2glb
```

---

## Usage

### Generate all six variants

```bash
cd /path/to/PoseBlock
python tools/sam3d/generate_mannequins.py
```

### Specify a GPU / CPU

```bash
python tools/sam3d/generate_mannequins.py --device cuda
python tools/sam3d/generate_mannequins.py --device cpu
```

### Process a subset of variants

```bash
python tools/sam3d/generate_mannequins.py --variants female/adult male/adult
```

### Re-run only the Blender + fbx2glb stages (cached PLY/keypoints)

```bash
python tools/sam3d/generate_mannequins.py --skip-inference
```

### Re-run only fbx2glb (cached FBX)

```bash
python tools/sam3d/generate_mannequins.py --skip-inference --skip-blender
```

### Skip deployment to public/models

```bash
python tools/sam3d/generate_mannequins.py --no-deploy
```

### Use a different Hugging Face model repo

```bash
python tools/sam3d/generate_mannequins.py --hf-repo facebook/sam-3d-body-dinov3
```

Both repos load weights from the Hub automatically (no local checkpoint path).

---

## Intermediate outputs

Each variant writes to `tools/sam3d/output/<gender>/<age>/`:

| File | Description |
|------|-------------|
| `mesh.ply` | Raw 3D mesh from SAM 3D Body (camera space, colour) |
| `keypoints_mhr70.json` | 70 MHR joint positions in 3D |
| `mhr_params.json` | Full body_pose_params, shape_params, cam_t |
| `qc_overlay.jpg` | QC visualization: input photo + mesh overlay |
| `mannequin.fbx` | Mixamo-rigged mesh from Blender |
| `mannequin.glb` | Final binary glTF ready for PoseBlock |

---

## MHR → Mixamo joint mapping

`mhr_to_mixamo.py` computes Mixamo bone head positions from the 70 MHR
keypoints:

| Mixamo bone | Derived from MHR keypoint(s) |
|-------------|------------------------------|
| `Hips` | midpoint(left_hip, right_hip) |
| `Spine/Spine1/Spine2` | interpolated along hips → neck |
| `Neck` | neck (idx 69) |
| `Head` | 40 % of nose → neck direction |
| `LeftArm` | left_shoulder (idx 5) |
| `LeftForeArm` | left_elbow (idx 7) |
| `LeftHand` | left_wrist (idx 62) |
| `LeftUpLeg` | left_hip (idx 9) |
| `LeftLeg` | left_knee (idx 11) |
| `LeftFoot` | left_ankle (idx 13) |
| `LeftToeBase` | midpoint(left_big_toe, left_small_toe) |
| Finger bones | individual MHR hand keypoints (idx 42–62) |
| *(Right-side bones mirror the above)* | |

`blender_rig_export.py` feeds these positions into a Blender armature, then
uses **Automatic Weights** (heat-diffusion skinning) to bind the mesh. The
result is a fully-skinned, Mixamo-named rig compatible with PoseBlock's
existing pose system.

---

## Troubleshooting

**"No person detected"** — the mannequin silhouette may be too faint. Try the
`--use_mask` option by editing `run_inference()` in `generate_mannequins.py`.

**Gated model / 403** — confirm access on the model page and `hf auth login`
with the same account. Weights must load from the Hub; there is no
`--checkpoint-path` fallback.

**ModuleNotFoundError: sam_3d_body** — set `SAM3D_BODY_ROOT` to your
sam-3d-body clone (see Prerequisites).

**fbx2glb "unsupported FBX version"** — use Blender 3.6 LTS; its FBX exporter
outputs FBX 7.4 which fbx2glb supports.

**Poor skinning quality** — the T-pose mannequin images are ideal for
Automatic Weights. If results are poor, open the generated FBX in Blender and
manually adjust vertex group weights before re-exporting.
