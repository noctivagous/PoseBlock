# AGENTS.md

Compact guidance for OpenCode sessions working in PoseBlock. Trust `package.json` and source over `README.md` (README is stale on versions and still references Leva, which was removed).

## Commands

- `npm run dev` — standalone Next.js app at http://localhost:3000 (no VideoGen dependency).
- `npm run build` — full Next build (also typechecks).
- `npx tsc --noEmit` — fast, reliable typecheck (no emit). Prefer this during dev.
- `npm run test` / `npm run test:watch` — vitest, node environment.
- `npm run lint` — **currently noisy**: `eslint.config.mjs` does not ignore `tools/`, so it lints CMake build artifacts under `tools/fbx2.1glb/build/` and the Python venv under `tools/sam3d/.venv/` (~51 false errors). To lint app source only: `npx eslint . --ignore-pattern 'tools/**'`. There is also 1 pre-existing real error at `components/CharacterManipulator.tsx:102` (`react-hooks/set-state-in-effect`) — verify before "fixing".
- `./scripts/verify_setup.sh` — **stale, will fail**: checks for `public/models/xbot_mixamo.glb` etc. (actual files are `X Bot.glb`, `Y Bot.glb`) and greps for a removed `toDataURL` in `ExportButton.tsx`. Don't rely on it.

## Architecture (non-obvious from filenames)

- **Dual identity**: PoseBlock is both a standalone Next.js app and an npm package (`poseblock`) consumed by VideoGen via `"poseblock": "file:./PoseBlock"`. `package.json` `exports` maps subpaths **directly to source `.ts`/`.tsx`** (no build step); VideoGen transpiles it.
- **Package boundary rule: use relative imports only** in `components/`, `lib/`, `index.ts`, `types.ts` — never `@/`. The `@/*` alias exists in `tsconfig.json` / `vitest.config.ts` but is unused in package source; using it breaks VideoGen consumption. (A past commit converted all `@/` to relative for this reason.)
- **Compositor pattern (deliberate)**: 2D `<img>` backdrop (`PreviewFrame`) + transparent R3F WebGL overlay (`Scene`, orthographic camera, `alpha: true`, `preserveDrawingBuffer: true`). NOT a 3D backdrop plane — the background must stay pixel-perfect/undistorted for inpainting. Export = 2D canvas composite at backdrop native resolution (`lib/exportComposite.ts`).
- **App shell**: `app/page.tsx` is thin — `PoseBlockCompositor` (center) + `PoseBlockDevPanel` (right sidebar). `PoseBlockCompositor` is the embeddable root VideoGen imports; `PoseBlockDevPanel` mirrors VideoGen's right-panel layout for standalone parity. `embedMode` prop leaves backdrop/dimensions to the host.
- **State**: Zustand `useStore` (`lib/store.ts`). Multi-instance: `instances: CharacterInstance[]`, `MAX_INSTANCES = 10` (matches VideoGen crowd limit). Selection: click selects, Shift+click toggles multi-select. `PoseBlockCompositor` registers `onInstanceChange` / `onSelect` callbacks in the store so inner components emit changes outward without prop drilling.
- **Coordinates**: rendering uses ortho world units (`VIEW_HEIGHT = 4`). Persisted/transmitted state uses VideoGen's **normalized feet-anchor** convention — `x: 0–1 left→right`, `y: 0–1 top→bottom` (`>1` = feet below frame, for CU/ECU), `scale`: visual height multiplier. Convert via `lib/framing/` (`anchorToWorldTransform` / `worldTransformToAnchor`). World units are display-only; never persist them.
- **Skinned meshes**: clone with `SkeletonUtils.clone()` — plain `scene.clone()` breaks skinning. Bone names carry the `mixamorig:` prefix; use `canonicalBoneName` to strip it. Apply poses with `lerpPose(skeleton, pose, 1)` + `updateSkeleton()`.
- **Stack** (from `package.json`): Next 16, React 19, R3F v9, drei v10, three 0.175, Zustand 5. `next.config.ts` sets `transpilePackages: ['three']`. README's "Next 14 / React 18 / R3F v8" table is wrong; `INTEGRATION.md` is current.

## Runtime data loading

- **Models**: `app/api/models/route.ts` GET recursively scans `public/models/` for `.glb`/`.fbx` and serves a `CharacterModel[]` (filenames with spaces are URL-encoded). Drop a file in `public/models/` and it auto-appears in the picker. Actual shipped files: `X Bot.glb`, `Y Bot.glb` (spaces in names). `public/unused-models/` is gitignored.
- **Poses**: built-in `POSES` (`lib/poses.ts`) merged with JSON presets loaded from `poses/` via `app/api/poses/route.ts` GET. `POST /api/poses { name, pose }` writes `poses/<name>.json`; `name` must match `/^[a-z0-9][a-z0-9_-]{0,63}$/`. Pose JSON shape: `{ pose: { BoneName: [x,y,z,w] } }` (a bare pose object is also accepted). `poses/pose-models/` is gitignored (generated).
- `usePoseBlockBootstrap` (`lib/usePoseBlockBootstrap.ts`) fetches `/api/models` and `/api/poses` on mount and seeds one instance if none exist. When embedded in VideoGen, the host drives instances via props instead.

## Native tools / asset pipeline

- `tools/fbx2.1glb` is a git submodule — run `git submodule update --init --recursive` before building.
- **fbx2glb**: build with `npm run build:fbx2glb` (cmake on the submodule) → installs to `tools/bin/fbx2glb`. Override path with `POSEBLOCK_FBX2GLB` env var. Required by `npm run convert:fbx -- <input.fbx>` and the `tools/sam3d` mannequin pipeline.
- **Pose extraction scripts**:
  - `npm run extract:pose -- --input <file.glb> --clip <name> --frame <n> --fps 30 --out poses/<name>.json` — samples a GLB animation clip at a frame/time and emits a pose JSON.
  - `npm run extract:mixamoBind` — regenerates `poses/mixamo-reference-bind.json` from `public/models/Y Bot.glb`.
  - `npm run extract:poseModels` — batches extraction across `poses/pose-models/` GLBs.
- **SAM 3D Body mannequin pipeline**: `python tools/sam3d/generate_mannequins.py` (HuggingFace gated weights + Blender + fbx2glb). See `tools/sam3d/README.md` and `docs/CHARACTER-PIPELINE.md`. Not needed for app dev; requires HF gated access + `SAM3D_BODY_ROOT`.

## Tests

- Only `lib/framing/anchorAdapter.test.ts` (4 tests) — covers anchor↔world and bounds↔anchor round-trips at 16:9, 9:16, and ECU (`y > 1`) extremes.
- Run one file: `npx vitest run lib/framing/anchorAdapter.test.ts`. Watch: `npm run test:watch`.
- Coordinate math changes should keep these round-trips green; add cases for new aspect ratios or scale extremes.

## Repo boundaries

- `tsconfig.json` excludes `tools/`; ESLint does not (see Commands). Keep generated/build artifacts out of `components/`, `lib/`, `app/`.
- Gitignored generated dirs: `poses/pose-models/`, `assets/raw/`, `tools/fbx2.1glb/build/`, `tools/bin/`, `tools/sam3d/{output,checkpoints,model-images,.venv}/`, `public/unused-models/`.
