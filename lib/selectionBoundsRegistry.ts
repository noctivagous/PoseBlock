import type * as THREE from 'three'

const boundsById = new Map<string, THREE.Object3D>()

export function registerSelectionBounds(id: string, object: THREE.Object3D | null): void {
  if (object) boundsById.set(id, object)
  else boundsById.delete(id)
}

export function getSelectionBounds(id: string): THREE.Object3D | undefined {
  return boundsById.get(id)
}
