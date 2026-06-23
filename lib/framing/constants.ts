/** Figure height as fraction of frame height at scale=1 — matches VideoGen bake. */
export const MANNEQUIN_BASE_HEIGHT_RATIO = 0.55

export const MANNEQUIN_SCALE_MIN = 0.1
export const MANNEQUIN_SCALE_MAX = 20

export const MANNEQUIN_ANCHOR_X_MIN = 0
export const MANNEQUIN_ANCHOR_X_MAX = 1
export const MANNEQUIN_ANCHOR_Y_MIN = 0
export const MANNEQUIN_ANCHOR_Y_MAX_BASE = 2.5

/** 3D GLB feet center — models are centered horizontally after fit. */
export const GLB_FEET_CENTER_X = 0.5

/** GLB content uses full fitted bbox (no PNG alpha padding). */
export const GLB_CONTENT_HEIGHT_RATIO = 1

/** Model normalized height in world units after CharacterManipulator fit. */
export const TARGET_MODEL_WORLD_HEIGHT = 1.8

export const REFERENCE_PLACEMENT_X = 0.5
