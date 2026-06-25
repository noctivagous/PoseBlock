import type * as THREE from 'three'
import type { MannequinPivotOffsets } from './characterTransform'

export type SelectionBoundsMeta = {
  object: THREE.Object3D
  pivots: MannequinPivotOffsets
}

const boundsById = new Map<string, SelectionBoundsMeta>()

export function registerSelectionBounds(
  id: string,
  object: THREE.Object3D | null,
  pivots?: MannequinPivotOffsets,
): void {
  if (object && pivots) {
    boundsById.set(id, { object, pivots })
  } else {
    boundsById.delete(id)
  }
}

export function getSelectionBounds(id: string): THREE.Object3D | undefined {
  return boundsById.get(id)?.object
}

export function getSelectionBoundsMeta(id: string): SelectionBoundsMeta | undefined {
  return boundsById.get(id)
}
