import { clampMannequinScale } from './framing/anchorLayout'

/** Depth (Z) is stored separately; ortho camera can't show Z alone, so we couple it to display scale. */

export const Z_STEP = 0.15
export const MIN_CHARACTER_Z = -1.2
export const MAX_CHARACTER_Z = 1.2
export const DEPTH_SCALE_SENSITIVITY = 0.35

export function clampCharacterZ(z: number): number {
  return Math.min(MAX_CHARACTER_Z, Math.max(MIN_CHARACTER_Z, z))
}

/** Multiplier applied on top of characterScale so nearer Z reads larger on screen. */
export function depthScaleFactor(z: number): number {
  return Math.max(0.2, 1 + z * DEPTH_SCALE_SENSITIVITY)
}

export function displayScale(baseScale: number, z: number): number {
  return baseScale * depthScaleFactor(z)
}

export function baseScaleFromDisplay(display: number, z: number): number {
  const factor = depthScaleFactor(z)
  return factor > 0 ? display / factor : display
}

/** Dolly in depth while updating anchor scale so size changes on an ortho view. */
export function dollyAnchor(
  anchor: { scale: number },
  characterZ: number,
  direction: 1 | -1,
): { scale: number; characterZ: number } {
  const newZ = clampCharacterZ(characterZ + direction * Z_STEP)
  const ratio = depthScaleFactor(newZ) / depthScaleFactor(characterZ)
  return {
    characterZ: newZ,
    scale: clampMannequinScale(anchor.scale * ratio),
  }
}
