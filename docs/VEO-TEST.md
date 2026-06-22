# Veo Validation Test Plan

Manual end-to-end test after generating a SAM character and retargeting to Mixamo.

## Prerequisites

- `teen_f_mixamo.glb` in `public/models/` (see [CHARACTER-PIPELINE.md](./CHARACTER-PIPELINE.md))
- A video frame image (16:9 preferred) for backdrop
- Access to Google Veo (or equivalent image-to-video tool)

## Steps

### 1. Start PoseBlock

```bash
npm run dev
```

Open http://localhost:3000

### 2. Load character and pose

| Control | Value |
|---------|-------|
| character | `xbot` or `teen_f` |
| pose | `pointing_right` |
| scale | adjust size in frame |
| positionX / positionY | fine-tune (or drag in preview) |

Upload your video frame as backdrop (**Upload frame** button). The image renders as a flat 2D bitmap — no perspective warp.

Drag anywhere in the preview to position the mannequin.

### 4. Export PNG

Click **Export for inpainting** (bottom-right). This composites:

1. Original image at **native resolution** (e.g. 1920×1080)
2. Transparent 3D mannequin layer on top

The backdrop is never resampled through a 3D plane.

### 5. Test in Veo

1. Upload `pose_blocking.png` as the reference image
2. Prompt example: `person pointing to the right, same pose and framing`
3. Generate a short clip

### 6. Acceptance criteria

| # | Check | Pass? |
|---|-------|-------|
| 1 | `teen_f_mixamo.glb` loads without skeleton error | |
| 2 | `pointing_right` pose visible before export | |
| 3 | Headroom slider reframes character in real time | |
| 4 | Exported PNG matches viewport | |
| 5 | Veo character points same direction as blocker | |

### Troubleshooting

**Arm points wrong direction**

- Bone mirroring issue — in Blender, rotate problematic hand bones 180° on X and re-export
- Check browser console for `[poses] Missing bones:` warnings

**Character scale wrong**

- Tune `scale` / `position` in `components/Character.tsx`
- Re-run retarget script with `--target-height 1.7`

**Veo ignores pose**

- Increase contrast between character and backdrop
- Try a simpler backdrop (less visual noise)
- Ensure full body is visible in frame

## Automated checks (no Veo required)

```bash
npm run build          # TypeScript + production build
npm run lint           # ESLint
```

Export function is in `components/ExportButton.tsx` → `exportCanvasPNG()`.

Future videogen integration: replace download in `ExportButton` with `generateVideo({ image_1: dataURL })`.
