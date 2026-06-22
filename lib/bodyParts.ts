export type BodyPartId =
  | 'head'
  | 'torso'
  | 'leftArm'
  | 'rightArm'
  | 'leftHand'
  | 'rightHand'
  | 'stance'
  | 'whole'

export type BodyPartDef = {
  id: BodyPartId
  label: string
  pickBone: string
  pickRadius: number
}

export const BODY_PARTS: BodyPartDef[] = [
  { id: 'head', label: 'Head', pickBone: 'Head', pickRadius: 0.14 },
  { id: 'torso', label: 'Torso', pickBone: 'Spine2', pickRadius: 0.22 },
  { id: 'leftArm', label: 'Left arm', pickBone: 'LeftArm', pickRadius: 0.12 },
  { id: 'rightArm', label: 'Right arm', pickBone: 'RightArm', pickRadius: 0.12 },
  { id: 'leftHand', label: 'Left hand', pickBone: 'LeftHand', pickRadius: 0.09 },
  { id: 'rightHand', label: 'Right hand', pickBone: 'RightHand', pickRadius: 0.09 },
  { id: 'stance', label: 'Legs', pickBone: 'Hips', pickRadius: 0.2 },
  { id: 'whole', label: 'Whole body', pickBone: 'Hips', pickRadius: 0.28 },
]

export function bodyPartById(id: BodyPartId): BodyPartDef {
  return BODY_PARTS.find((p) => p.id === id) ?? BODY_PARTS[0]
}
