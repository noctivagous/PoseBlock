# Character Asset Pipeline

Generate Mixamo-rigged GLB models from full-body photos using SAM 3D Body, for use in PoseBlock.

## Prerequisites

1. **Hugging Face account** — https://huggingface.co/join
2. **Access token** (read) — https://huggingface.co/settings/tokens
3. **Accept gated model license** — https://huggingface.co/facebook/sam-3d-body-dinov3 (click "Agree and access repository")
4. **Python 3.10+** with pip
5. **Blender 3.6+** (for retarget step)

## Environment

```bash
export HF_TOKEN=hf_your_token_here
pip install -r scripts/requirements.txt
```

## Step 1: Generate MHR mesh from photo

```bash
python scripts/generate_character.py path/to/full_body.jpg --name teen_f
```

This tries Hugging Face Spaces in order:

1. [dev-bjoern/sam-3d-body-mcp](https://huggingface.co/spaces/dev-bjoern/sam-3d-body-mcp)
2. [akhaliq/sam-3d-body](https://huggingface.co/spaces/akhaliq/sam-3d-body)
3. [iAkashPaul/sam-3d-body](https://huggingface.co/spaces/iAkashPaul/sam-3d-body)

Output: `assets/raw/teen_f_mhr.glb`

> **Note:** `public/models/teen_f_mixamo.glb` ships as a copy of the Y-Bot placeholder until you run the Blender retarget step below with a real SAM output.

### Manual fallback

If the script cannot reach a Space (rate limits, API changes):

1. Open https://huggingface.co/spaces/akhaliq/sam-3d-body in a browser
2. Upload your full-body photo
3. Download the GLB/OBJ output
4. Save as `assets/raw/teen_f_mhr.glb`

### Alternative: SAM-3D-Pose-Analyzer CLI

```bash
git clone https://github.com/chchannel/SAM-3D-Pose-Analyzer
# Follow repo README — exports Blender-ready mesh + armature
```

## Step 2: Retarget MHR → Mixamo

```bash
blender --background --python scripts/blender/retarget_mhr_to_mixamo.py -- \
  --input assets/raw/teen_f_mhr.glb \
  --template public/models/ybot_mixamo.glb \
  --output public/models/teen_f_mixamo.glb
```

This script:

- Imports the SAM MHR-rigged mesh
- Uses the Y-Bot Mixamo armature as the target skeleton
- Maps bones via `scripts/blender/bone_map_mhr_mixamo.json`
- Transfers vertex weights to the Mixamo rig
- Normalizes height to ~1.7m
- Downscales textures to 2048px max
- Exports GLB to `public/models/`

### Debugging bone names

Load the MHR GLB in Blender, select the armature, and list bone names in the Python console:

```python
[b.name for b in bpy.context.object.data.bones]
```

Update `scripts/blender/bone_map_mhr_mixamo.json` if names differ.

In PoseBlock dev mode, the browser console logs skeleton bone names when a model loads.

## Step 3: Use in PoseBlock

1. `npm run dev`
2. In Leva, select `teen_f` character (once `teen_f_mixamo.glb` exists)
3. Pick a pose (e.g. `pointing_right`)
4. Upload a video frame as backdrop
5. Adjust headroom / field size
6. Click **Export for Veo**

## Texture notes

SAM outputs can include 4K textures. The Blender export script resizes to 2048px for web performance. Originals remain in `assets/raw/`.

## File layout

```
assets/raw/           # SAM output (gitignored)
public/models/        # Mixamo-rigged GLBs served by Next.js
  ybot_mixamo.glb     # Dev placeholder (Mixamo X-Bot)
  teen_f_mixamo.glb   # Your retargeted character
```
