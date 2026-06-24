export type BodyPartId =
  | 'head'
  | 'neck'
  | 'torso'
  | 'leftArm'
  | 'leftForeArm'
  | 'rightForeArm'
  | 'rightArm'
  | 'leftHand'
  | 'rightHand'
  | 'leftUpLeg'
  | 'rightUpLeg'
  | 'leftLeg'
  | 'rightLeg'
  | 'leftFoot'
  | 'rightFoot'
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
  { id: 'neck', label: 'Neck', pickBone: 'Neck', pickRadius: 0.08 },
  { id: 'torso', label: 'Torso', pickBone: 'Spine2', pickRadius: 0.22 },
  { id: 'leftArm', label: 'Left arm', pickBone: 'LeftArm', pickRadius: 0.12 },
  { id: 'leftForeArm', label: 'Left forearm', pickBone: 'LeftForeArm', pickRadius: 0.09 },
  { id: 'rightArm', label: 'Right arm', pickBone: 'RightArm', pickRadius: 0.12 },
  { id: 'rightForeArm', label: 'Right forearm', pickBone: 'RightForeArm', pickRadius: 0.09 },
  { id: 'leftHand', label: 'Left hand', pickBone: 'LeftHand', pickRadius: 0.09 },
  { id: 'rightHand', label: 'Right hand', pickBone: 'RightHand', pickRadius: 0.09 },
  { id: 'leftUpLeg', label: 'Left thigh', pickBone: 'LeftUpLeg', pickRadius: 0.1 },
  { id: 'leftLeg', label: 'Left lower leg', pickBone: 'LeftLeg', pickRadius: 0.09 },
  { id: 'leftFoot', label: 'Left foot', pickBone: 'LeftFoot', pickRadius: 0.09 },
  { id: 'rightUpLeg', label: 'Right thigh', pickBone: 'RightUpLeg', pickRadius: 0.1 },
  { id: 'rightLeg', label: 'Right lower leg', pickBone: 'RightLeg', pickRadius: 0.09 },
  { id: 'rightFoot', label: 'Right foot', pickBone: 'RightFoot', pickRadius: 0.09 },
  { id: 'stance', label: 'Legs', pickBone: 'Hips', pickRadius: 0.2 },
  { id: 'whole', label: 'Whole body', pickBone: 'Hips', pickRadius: 0.28 },
]

export function bodyPartById(id: BodyPartId): BodyPartDef {
  return BODY_PARTS.find((p) => p.id === id) ?? BODY_PARTS[0]
}
