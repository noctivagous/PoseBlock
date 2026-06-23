export {
  anchorToWorldTransform,
  applyAnchorToGroup,
  syncAnchorFromGroup,
  worldTransformToAnchor,
  type FeetAnchor,
  type WorldTransform,
} from '@/lib/framing/anchorAdapter'

export {
  anchorToBoundsFrame,
  boundsFrameToAnchor,
  clampMannequinAnchor,
  clampMannequinScale,
  maxFeetAnchorY,
  parseAspectRatio,
  patchBoundsFrame,
  type MannequinBoundsFrame,
} from '@/lib/framing/anchorLayout'

export {
  GLB_FEET_CENTER_X,
  MANNEQUIN_BASE_HEIGHT_RATIO,
  MANNEQUIN_SCALE_MAX,
  MANNEQUIN_SCALE_MIN,
  TARGET_MODEL_WORLD_HEIGHT,
} from '@/lib/framing/constants'
