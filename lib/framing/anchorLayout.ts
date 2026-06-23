import {
  GLB_CONTENT_HEIGHT_RATIO,
  GLB_FEET_CENTER_X,
  MANNEQUIN_ANCHOR_X_MAX,
  MANNEQUIN_ANCHOR_X_MIN,
  MANNEQUIN_ANCHOR_Y_MAX_BASE,
  MANNEQUIN_ANCHOR_Y_MIN,
  MANNEQUIN_BASE_HEIGHT_RATIO,
  MANNEQUIN_SCALE_MAX,
  MANNEQUIN_SCALE_MIN,
  REFERENCE_PLACEMENT_X,
} from '@/lib/framing/constants'

export interface ClampMannequinAnchorOptions {
  maxY?: number
}

export function parseAspectRatio(frameWidth: number, frameHeight: number): number {
  if (!frameWidth || !frameHeight) return 16 / 9
  return frameWidth / frameHeight
}

export function maxFeetAnchorY(scale: number): number {
  const figureSpan = scale * MANNEQUIN_BASE_HEIGHT_RATIO
  return Math.max(MANNEQUIN_ANCHOR_Y_MAX_BASE, 1 + figureSpan * 1.15)
}

export function clampMannequinAnchor(
  position: { x: number; y: number },
  options?: ClampMannequinAnchorOptions,
): { x: number; y: number } {
  const yMax = options?.maxY ?? MANNEQUIN_ANCHOR_Y_MAX_BASE
  return {
    x: Math.min(MANNEQUIN_ANCHOR_X_MAX, Math.max(MANNEQUIN_ANCHOR_X_MIN, position.x)),
    y: Math.min(yMax, Math.max(MANNEQUIN_ANCHOR_Y_MIN, position.y)),
  }
}

export function clampMannequinScale(scale: number): number {
  return Math.min(MANNEQUIN_SCALE_MAX, Math.max(MANNEQUIN_SCALE_MIN, scale))
}

function placementShiftX(anchorX: number): number {
  return anchorX - REFERENCE_PLACEMENT_X
}

function visualHeightFromScale(scale: number): number {
  return MANNEQUIN_BASE_HEIGHT_RATIO * scale
}

function modelWidthFrac(visualHeight: number, aspect: number): number {
  const modelHeight = visualHeight / GLB_CONTENT_HEIGHT_RATIO
  return modelHeight / aspect
}

function insetTopFromFeetY(feetY: number, visualHeight: number): number {
  return feetY - visualHeight
}

function feetYFromInsetTop(insetTop: number, visualHeight: number): number {
  return insetTop + visualHeight
}

/** Relational bounds — same shape as VideoGen MannequinBoundsFrame. */
export type MannequinBoundsFrame = {
  insetLeft: number
  insetRight: number
  insetTop: number
  insetBottom: number
  widthToFrameHeight: number
}

export function anchorToBoundsFrame(
  anchor: Pick<{ x: number; y: number; scale: number }, 'x' | 'y' | 'scale'>,
  aspect: number,
  placementX = REFERENCE_PLACEMENT_X,
): MannequinBoundsFrame {
  const height = visualHeightFromScale(anchor.scale)
  const width = modelWidthFrac(height, aspect)
  const insetBottom = 1 - anchor.y
  const insetTop = insetTopFromFeetY(anchor.y, height)
  const insetLeft = anchor.x - GLB_FEET_CENTER_X * width - placementShiftX(placementX)

  return {
    insetLeft,
    insetRight: 1 - insetLeft - width,
    insetTop,
    insetBottom,
    widthToFrameHeight: width * aspect,
  }
}

export function boundsFrameToAnchor(
  bounds: MannequinBoundsFrame,
  aspect: number,
  placementX = REFERENCE_PLACEMENT_X,
): { x: number; y: number; scale: number } {
  const width = bounds.widthToFrameHeight / aspect
  const scale = clampMannequinScale(bounds.widthToFrameHeight / MANNEQUIN_BASE_HEIGHT_RATIO)
  const visualHeight = visualHeightFromScale(scale)
  const y = clampMannequinAnchor(
    { x: 0.5, y: feetYFromInsetTop(bounds.insetTop, visualHeight) },
    { maxY: maxFeetAnchorY(scale) },
  ).y
  const x = bounds.insetLeft + GLB_FEET_CENTER_X * width + placementShiftX(placementX)
  return { x, y, scale }
}

export function patchBoundsFrame(
  bounds: MannequinBoundsFrame,
  patch: Partial<MannequinBoundsFrame>,
  aspect: number,
): MannequinBoundsFrame {
  const next: MannequinBoundsFrame = { ...bounds, ...patch }

  if (patch.widthToFrameHeight !== undefined) {
    const widthFrac = next.widthToFrameHeight / aspect
    next.insetRight = 1 - next.insetLeft - widthFrac
  } else if (patch.insetLeft !== undefined && patch.insetRight === undefined) {
    const widthFrac = bounds.widthToFrameHeight / aspect
    next.insetRight = 1 - next.insetLeft - widthFrac
  } else if (patch.insetRight !== undefined && patch.insetLeft === undefined) {
    const widthFrac = bounds.widthToFrameHeight / aspect
    next.insetLeft = 1 - next.insetRight - widthFrac
  } else if (patch.insetLeft !== undefined || patch.insetRight !== undefined) {
    const widthFrac = 1 - next.insetLeft - next.insetRight
    next.widthToFrameHeight = widthFrac * aspect
  }

  if (
    patch.widthToFrameHeight !== undefined ||
    patch.insetTop !== undefined ||
    patch.insetLeft !== undefined ||
    patch.insetRight !== undefined
  ) {
    const scale = clampMannequinScale(next.widthToFrameHeight / MANNEQUIN_BASE_HEIGHT_RATIO)
    const height = visualHeightFromScale(scale)
    next.insetBottom = 1 - next.insetTop - height
  }

  return next
}
