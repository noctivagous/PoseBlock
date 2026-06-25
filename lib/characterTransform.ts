import * as THREE from 'three'
import { clampMannequinScale } from './framing/anchorLayout'
import {
  anchorToWorldTransform,
  worldTransformToAnchor,
} from './framing/anchorAdapter'

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

export function bboxModelCenterPivot(
  center: THREE.Vector3,
  fitScale: number,
  yOffset: number,
): THREE.Vector3 {
  return new THREE.Vector3(
    center.x * fitScale,
    center.y * fitScale + yOffset,
    center.z * fitScale,
  )
}

export type MannequinPivotOffsets = {
  modelCenter: THREE.Vector3
  /** Feet origin in yawNeg local space (same anchor as dolly / pitch). */
  feetFromYawNeg: THREE.Vector3
}

export function mannequinPivotOffsets(
  center: THREE.Vector3,
  size: THREE.Vector3,
  fitScale: number,
  yOffset: number,
): MannequinPivotOffsets {
  return {
    modelCenter: bboxModelCenterPivot(center, fitScale, yOffset),
    feetFromYawNeg: new THREE.Vector3(0, yOffset, 0),
  }
}

const _feetWorld = new THREE.Vector3()

export function computeMannequinFeetWorld(params: {
  x: number
  y: number
  scale: number
  rotation: number
  characterZ: number
  characterRotationX: number
  characterRotationZ: number
  modelCenter: THREE.Vector3
  feetFromYawNeg: THREE.Vector3
  frameWidth: number
  frameHeight: number
}): THREE.Vector3 {
  const world = anchorToWorldTransform({
    anchor: { x: params.x, y: params.y, scale: params.scale, rotation: params.rotation },
    characterZ: params.characterZ,
    characterRotationX: params.characterRotationX,
    characterRotationZ: params.characterRotationZ,
    frameWidth: params.frameWidth,
    frameHeight: params.frameHeight,
  })
  const DEG2RAD = Math.PI / 180

  const root = new THREE.Object3D()
  root.position.set(world.worldX, world.worldY, world.worldZ)
  root.rotation.x = world.characterRotationX * DEG2RAD
  root.rotation.z = params.characterRotationZ * DEG2RAD
  root.scale.setScalar(displayScale(world.characterScale, world.worldZ))

  const yawPivot = new THREE.Object3D()
  yawPivot.position.copy(params.modelCenter)
  root.add(yawPivot)

  const yawSpin = new THREE.Object3D()
  yawSpin.rotation.y = params.rotation * DEG2RAD
  yawPivot.add(yawSpin)

  const yawNeg = new THREE.Object3D()
  yawNeg.position.copy(params.modelCenter).multiplyScalar(-1)
  yawSpin.add(yawNeg)

  root.updateMatrixWorld(true)
  return yawNeg.localToWorld(_feetWorld.copy(params.feetFromYawNeg))
}

export function rotateMannequinYawAroundModelCenter(params: {
  x: number
  y: number
  scale: number
  rotation: number
  characterZ: number
  characterRotationX: number
  characterRotationZ: number
  modelCenter: THREE.Vector3
  feetFromYawNeg: THREE.Vector3
  deltaRotationDeg: number
  frameWidth: number
  frameHeight: number
}): { x: number; y: number; rotation: number; characterRotationY: number } {
  const newRotation = params.rotation + params.deltaRotationDeg
  const feetWorld = computeMannequinFeetWorld({ ...params, rotation: newRotation })
  const world = anchorToWorldTransform({
    anchor: { x: params.x, y: params.y, scale: params.scale, rotation: params.rotation },
    characterZ: params.characterZ,
    characterRotationX: params.characterRotationX,
    characterRotationZ: params.characterRotationZ,
    frameWidth: params.frameWidth,
    frameHeight: params.frameHeight,
  })
  const synced = worldTransformToAnchor({
    worldX: feetWorld.x,
    worldY: feetWorld.y,
    worldZ: params.characterZ,
    characterScale: world.characterScale,
    characterRotationX: params.characterRotationX,
    characterRotationY: newRotation,
    characterRotationZ: params.characterRotationZ,
    frameWidth: params.frameWidth,
    frameHeight: params.frameHeight,
  })
  return { x: synced.x, y: synced.y, rotation: newRotation, characterRotationY: newRotation }
}

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
