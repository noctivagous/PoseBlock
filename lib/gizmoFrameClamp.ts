import * as THREE from 'three'
import { VIEW_HEIGHT } from './sceneConstants'

export type ViewBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export type ControlExtentsPx = {
  width: number
  height: number
}

const _world = new THREE.Vector3()
const _clamped = new THREE.Vector3()
const _local = new THREE.Vector3()

/** Visible ortho frustum in world units (matches Scene FrameCamera). */
export function orthoViewBounds(aspect: number): ViewBounds {
  const halfW = (VIEW_HEIGHT * aspect) / 2
  const halfH = VIEW_HEIGHT / 2
  return { minX: -halfW, maxX: halfW, minY: -halfH, maxY: halfH }
}

export function clampWorldPointToView(
  point: THREE.Vector3,
  extents: ControlExtentsPx,
  bounds: ViewBounds,
  canvasHeight: number,
): THREE.Vector3 {
  const pxToWorld = VIEW_HEIGHT / Math.max(canvasHeight, 1)
  const halfW = (extents.width / 2) * pxToWorld
  const halfH = (extents.height / 2) * pxToWorld
  const pad = pxToWorld * 6

  return _clamped.set(
    THREE.MathUtils.clamp(point.x, bounds.minX + halfW + pad, bounds.maxX - halfW - pad),
    THREE.MathUtils.clamp(point.y, bounds.minY + halfH + pad, bounds.maxY - halfH - pad),
    point.z,
  )
}

/** Keep Html control cluster (center anchor) inside the preview frame. */
export function clampGroupWorldToView(
  group: THREE.Object3D,
  extents: ControlExtentsPx,
  bounds: ViewBounds,
  canvasHeight: number,
): void {
  group.getWorldPosition(_world)
  const clamped = clampWorldPointToView(_world, extents, bounds, canvasHeight)
  if (_world.distanceToSquared(clamped) < 1e-12) return
  const parent = group.parent
  if (!parent) return
  _local.copy(clamped)
  parent.worldToLocal(_local)
  group.position.copy(_local)
}
