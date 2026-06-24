export type Axis = 'x' | 'y' | 'z'

export type AxisLimit = { min: number; max: number }

export type JointConstraint = {
  enabled: Record<Axis, boolean>
  limitsDeg: Record<Axis, AxisLimit>
}

const UNBOUNDED_LIMIT: AxisLimit = { min: -180, max: 180 }

function limit(min: number, max: number): AxisLimit {
  return { min, max }
}

export const DEFAULT_JOINT_CONSTRAINT: JointConstraint = {
  enabled: { x: true, y: true, z: true },
  limitsDeg: {
    x: UNBOUNDED_LIMIT,
    y: UNBOUNDED_LIMIT,
    z: UNBOUNDED_LIMIT,
  },
}

export const POSE_JOINT_LIMITS: Array<{
  pattern: RegExp
  constraint: JointConstraint
}> = [
  {
    pattern: /Head/i,
    constraint: {
      enabled: { x: true, y: true, z: true },
      limitsDeg: { x: limit(-45, 45), y: limit(-80, 80), z: limit(-40, 40) },
    },
  },
  {
    pattern: /Neck/i,
    constraint: {
      enabled: { x: true, y: true, z: true },
      limitsDeg: { x: limit(-35, 35), y: limit(-60, 60), z: limit(-30, 30) },
    },
  },
  {
    pattern: /Hips/i,
    constraint: {
      enabled: { x: true, y: true, z: true },
      limitsDeg: { x: limit(-35, 35), y: limit(-70, 70), z: limit(-35, 35) },
    },
  },
  {
    pattern: /Spine|Chest/i,
    constraint: {
      enabled: { x: true, y: true, z: true },
      limitsDeg: { x: limit(-35, 35), y: limit(-45, 45), z: limit(-25, 25) },
    },
  },
  {
    pattern: /Shoulder/i,
    constraint: {
      enabled: { x: true, y: true, z: true },
      limitsDeg: { x: limit(-40, 40), y: limit(-40, 40), z: limit(-40, 40) },
    },
  },
  {
    pattern: /ForeArm/i,
    constraint: {
      enabled: { x: true, y: true, z: true },
      limitsDeg: { x: limit(-5, 145), y: limit(-30, 30), z: limit(-20, 20) },
    },
  },
  {
    pattern: /Arm/i,
    constraint: {
      enabled: { x: true, y: true, z: true },
      limitsDeg: { x: limit(-130, 130), y: limit(-110, 110), z: limit(-140, 140) },
    },
  },
  {
    pattern: /Hand/i,
    constraint: {
      enabled: { x: true, y: true, z: true },
      limitsDeg: { x: limit(-70, 70), y: limit(-70, 70), z: limit(-70, 70) },
    },
  },
  {
    pattern: /UpLeg/i,
    constraint: {
      enabled: { x: true, y: true, z: true },
      limitsDeg: { x: limit(-100, 45), y: limit(-55, 55), z: limit(-45, 45) },
    },
  },
  {
    pattern: /Leg/i,
    constraint: {
      enabled: { x: true, y: true, z: true },
      limitsDeg: { x: limit(-150, 5), y: limit(-15, 15), z: limit(-10, 10) },
    },
  },
  {
    pattern: /Foot/i,
    constraint: {
      enabled: { x: true, y: true, z: true },
      limitsDeg: { x: limit(-45, 65), y: limit(-30, 30), z: limit(-20, 20) },
    },
  },
  {
    pattern: /Toe/i,
    constraint: {
      enabled: { x: true, y: true, z: true },
      limitsDeg: { x: limit(-25, 35), y: limit(-20, 20), z: limit(-20, 20) },
    },
  },
  {
    pattern: /Thumb|Index|Middle|Ring|Pinky/i,
    constraint: {
      enabled: { x: true, y: true, z: true },
      limitsDeg: { x: limit(-10, 95), y: limit(-20, 20), z: limit(-20, 20) },
    },
  },
]

export function constraintForBone(name: string): JointConstraint {
  for (const entry of POSE_JOINT_LIMITS) {
    if (entry.pattern.test(name)) return entry.constraint
  }
  return DEFAULT_JOINT_CONSTRAINT
}
