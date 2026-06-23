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

### 1. HuggingFace access

SAM 3D Body is gated. Request access at:
<https://huggingface.co/facebook/sam-3d-body-vith>

Log in once with the HF CLI:

```bash
hf auth login
```

### 2. Clone and install SAM 3D Body

```bash
git clone https://github.com/facebookresearch/sam-3d-body
cd sam-3d-body
pip install -e .
cd ..
```

Follow any additional steps in `sam-3d-body/INSTALL.md` (e.g., installing
optional ViTDet detector and SAM2 segmentor for best results).

### 3. Install Python requirements

```bash
pip install -r tools/sam3d/requirements.txt
```

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

### Use a custom HuggingFace model variant

```bash
python tools/sam3d/generate_mannequins.py --hf-repo facebook/sam-3d-body-dinov3
```

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

**Blender crash / ImportError for mhr_to_mixamo** — ensure `tools/sam3d` is in
Python's path. The Blender script inserts it automatically via `sys.path`.

**fbx2glb "unsupported FBX version"** — use Blender 3.6 LTS; its FBX exporter
outputs FBX 7.4 which fbx2glb supports.

**Poor skinning quality** — the T-pose mannequin images are ideal for
Automatic Weights. If results are poor, open the generated FBX in Blender and
manually adjust vertex group weights before re-exporting.
