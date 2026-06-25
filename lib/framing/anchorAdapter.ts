import { baseScaleFromDisplay, depthScaleFactor, displayScale } from '../../lib/characterTransform'
import {
  MANNEQUIN_BASE_HEIGHT_RATIO,
  TARGET_MODEL_WORLD_HEIGHT,
} from '../../lib/framing/constants'
import {
  clampMannequinAnchor,
  clampMannequinScale,
  maxFeetAnchorY,
  parseAspectRatio,
} from '../../lib/framing/anchorLayout'
import { VIEW_HEIGHT } from '../../lib/sceneConstants'

export type FeetAnchor = {
  x: number
  y: number
  scale: number
  rotation: number
}

export type WorldTransform = {
  worldX: number
  worldY: number
  worldZ: number
  characterScale: number
  characterRotationX: number
  characterRotationY: number
  characterRotationZ: number
}

export function anchorToWorldTransform(input: {
  anchor: FeetAnchor
  characterZ: number
  characterRotationX: number
  characterRotationZ?: number
  frameWidth: number
  frameHeight: number
}): WorldTransform {
  const aspect = parseAspectRatio(input.frameWidth, input.frameHeight)
  const viewWidth = VIEW_HEIGHT * aspect
  const { x, y, scale, rotation } = input.anchor

  const worldX = viewWidth * (x - 0.5)
  const worldY = VIEW_HEIGHT / 2 - y * VIEW_HEIGHT

  const visualHeight = scale * MANNEQUIN_BASE_HEIGHT_RATIO * VIEW_HEIGHT
  const depthFactor = depthScaleFactor(input.characterZ)
  const characterScale = visualHeight / (TARGET_MODEL_WORLD_HEIGHT * depthFactor)

  return {
    worldX,
    worldY,
    worldZ: input.characterZ,
    characterScale,
    characterRotationX: input.characterRotationX,
    characterRotationY: rotation,
    characterRotationZ: input.characterRotationZ ?? 0,
  }
}

export function worldTransformToAnchor(input: {
  worldX: number
  worldY: number
  worldZ: number
  characterScale: number
  characterRotationX: number
  characterRotationY: number
  characterRotationZ: number
  frameWidth: number
  frameHeight: number
}): FeetAnchor & { characterZ: number; characterRotationX: number; characterRotationZ: number } {
  const aspect = parseAspectRatio(input.frameWidth, input.frameHeight)
  const viewWidth = VIEW_HEIGHT * aspect

  const rawX = input.worldX / viewWidth + 0.5
  const rawY = (VIEW_HEIGHT / 2 - input.worldY) / VIEW_HEIGHT

  const display = displayScale(input.characterScale, input.worldZ)
  const visualHeight = display * TARGET_MODEL_WORLD_HEIGHT
  const rawScale = visualHeight / (MANNEQUIN_BASE_HEIGHT_RATIO * VIEW_HEIGHT)
  const scale = clampMannequinScale(rawScale)

  const clamped = clampMannequinAnchor(
    { x: rawX, y: rawY },
    { maxY: maxFeetAnchorY(scale) },
  )

  return {
    x: clamped.x,
    y: clamped.y,
    scale,
    rotation: input.characterRotationY,
    characterZ: input.worldZ,
    characterRotationX: input.characterRotationX,
    characterRotationZ: input.characterRotationZ,
  }
}

/** Sync world group after anchor edit (for applying anchor patches to Three.js group). */
export function applyAnchorToGroup(
  group: { position: { set: (x: number, y: number, z: number) => void }; rotation: { set: (x: number, y: number, z: number) => void }; scale: { setScalar: (s: number) => void } },
  anchor: FeetAnchor,
  characterZ: number,
  characterRotationX: number,
  frameWidth: number,
  frameHeight: number,
): void {
  const world = anchorToWorldTransform({
    anchor,
    characterZ,
    characterRotationX,
    frameWidth,
    frameHeight,
  })
  const DEG2RAD = Math.PI / 180
  group.position.set(world.worldX, world.worldY, world.worldZ)
  group.rotation.set(world.characterRotationX * DEG2RAD, 0, 0)
  group.scale.setScalar(displayScale(world.characterScale, world.worldZ))
}

export function syncAnchorFromGroup(
  group: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; scale: { x: number } },
  frameWidth: number,
  frameHeight: number,
  characterRotationY = 0,
  characterRotationZ = 0,
): FeetAnchor & { characterZ: number; characterRotationX: number; characterRotationZ: number } {
  const DEG2RAD = Math.PI / 180
  return worldTransformToAnchor({
    worldX: group.position.x,
    worldY: group.position.y,
    worldZ: group.position.z,
    characterScale: baseScaleFromDisplay(group.scale.x, group.position.z),
    characterRotationX: group.rotation.x / DEG2RAD,
    characterRotationY,
    characterRotationZ,
    frameWidth,
    frameHeight,
  })
}
