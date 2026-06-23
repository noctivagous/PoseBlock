'use client'

import { TransformControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { bodyPartById, type BodyPartId } from '../lib/bodyParts'
import type { PoseOp } from '../lib/poseCompose'
import { findSkeletonBone, updateSkeleton } from '../lib/poses'
import { useStore } from '../lib/store'

const RAD2DEG = 180 / Math.PI
const MIN_COMMIT_DEGREES = 0.1
type Axis = 'x' | 'y' | 'z'

type JointConstraint = {
  enabled: Record<Axis, boolean>
  limitsDeg: Partial<Record<Axis, number>>
}

const JOINT_CONSTRAINTS: Record<BodyPartId, JointConstraint> = {
  head: { enabled: { x: true, y: true, z: true }, limitsDeg: { x: 45, y: 80, z: 40 } },
  torso: { enabled: { x: true, y: true, z: true }, limitsDeg: { x: 35, y: 40, z: 20 } },
  leftArm: { enabled: { x: true, y: true, z: true }, limitsDeg: { x: 130, y: 90, z: 120 } },
  rightArm: { enabled: { x: true, y: true, z: true }, limitsDeg: { x: 130, y: 90, z: 120 } },
  leftHand: { enabled: { x: true, y: true, z: true }, limitsDeg: { x: 70, y: 70, z: 70 } },
  rightHand: { enabled: { x: true, y: true, z: true }, limitsDeg: { x: 70, y: 70, z: 70 } },
  stance: { enabled: { x: false, y: true, z: false }, limitsDeg: { y: 25 } },
  whole: { enabled: { x: true, y: true, z: true }, limitsDeg: { x: 35, y: 70, z: 35 } },
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function deltaToOps(
  delta: THREE.Quaternion,
  bone: string,
  constraint: JointConstraint
): PoseOp[] {
  const euler = new THREE.Euler().setFromQuaternion(delta, 'XYZ')
  const x = euler.x * RAD2DEG
  const y = euler.y * RAD2DEG
  const z = euler.z * RAD2DEG
  const ops: PoseOp[] = []
  if (constraint.enabled.x && Math.abs(x) >= MIN_COMMIT_DEGREES) {
    ops.push({ type: 'rotateBone', bone, axis: 'x', degrees: x })
  }
  if (constraint.enabled.y && Math.abs(y) >= MIN_COMMIT_DEGREES) {
    ops.push({ type: 'rotateBone', bone, axis: 'y', degrees: y })
  }
  if (constraint.enabled.z && Math.abs(z) >= MIN_COMMIT_DEGREES) {
    ops.push({ type: 'rotateBone', bone, axis: 'z', degrees: z })
  }
  return ops
}

export function PoseJointGizmo({ skeleton }: { skeleton: THREE.Skeleton }) {
  const interactionMode = useStore((s) => s.interactionMode)
  const selectedBodyPart = useStore((s) => s.selectedBodyPart)
  const pushPoseOps = useStore((s) => s.pushPoseOps)
  const helperRef = useRef<THREE.Group>(null)
  const draggingRef = useRef(false)
  const startBoneQuatRef = useRef(new THREE.Quaternion())
  const startHelperQuatRef = useRef(new THREE.Quaternion())
  const activeBoneRef = useRef<THREE.Bone | null>(null)
  const activeBoneNameRef = useRef<string>('')
  const activeConstraintRef = useRef<JointConstraint>(JOINT_CONSTRAINTS.head)
  const worldPosRef = useRef(new THREE.Vector3())
  const worldQuatRef = useRef(new THREE.Quaternion())
  const parentQuatRef = useRef(new THREE.Quaternion())
  const localQuatRef = useRef(new THREE.Quaternion())
  const constrainedDeltaRef = useRef(new THREE.Quaternion())

  const part = selectedBodyPart ? bodyPartById(selectedBodyPart) : null
  const constraint = selectedBodyPart
    ? JOINT_CONSTRAINTS[selectedBodyPart]
    : JOINT_CONSTRAINTS.head
  const activeBone = part ? findSkeletonBone(skeleton, part.pickBone) : null

  useEffect(() => {
    activeBoneRef.current = activeBone ?? null
    activeBoneNameRef.current = part?.pickBone ?? ''
    activeConstraintRef.current = constraint
  }, [activeBone, part?.pickBone, constraint])

  useFrame(() => {
    const helper = helperRef.current
    const bone = activeBoneRef.current
    if (!helper || !bone || draggingRef.current) return

    bone.getWorldPosition(worldPosRef.current)
    bone.getWorldQuaternion(worldQuatRef.current)

    helper.parent?.worldToLocal(worldPosRef.current)
    helper.position.copy(worldPosRef.current)

    if (helper.parent) {
      helper.parent.getWorldQuaternion(parentQuatRef.current)
      localQuatRef.current
        .copy(parentQuatRef.current)
        .invert()
        .multiply(worldQuatRef.current)
      helper.quaternion.copy(localQuatRef.current)
    }
  })

  if (interactionMode !== 'pose' || !activeBone) return null

  return (
    <>
      <group ref={helperRef}>
        <mesh>
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.35} depthTest={false} />
        </mesh>
      </group>

      <TransformControls
        object={helperRef as unknown as { current: THREE.Object3D }}
        mode="rotate"
        showX={constraint.enabled.x}
        showY={constraint.enabled.y}
        showZ={constraint.enabled.z}
        size={0.6}
        onMouseDown={() => {
          const bone = activeBoneRef.current
          const helper = helperRef.current
          if (!bone || !helper) return
          draggingRef.current = true
          startBoneQuatRef.current.copy(bone.quaternion)
          startHelperQuatRef.current.copy(helper.quaternion)
        }}
        onObjectChange={() => {
          if (!draggingRef.current) return
          const bone = activeBoneRef.current
          const helper = helperRef.current
          if (!bone || !helper) return
          const rawDelta = new THREE.Quaternion()
            .copy(startHelperQuatRef.current)
            .invert()
            .multiply(helper.quaternion)
          const rawEuler = new THREE.Euler().setFromQuaternion(rawDelta, 'XYZ')
          const constraintNow = activeConstraintRef.current

          const xLimit = constraintNow.limitsDeg.x ?? 180
          const yLimit = constraintNow.limitsDeg.y ?? 180
          const zLimit = constraintNow.limitsDeg.z ?? 180

          const x = constraintNow.enabled.x
            ? clamp(rawEuler.x * RAD2DEG, -xLimit, xLimit)
            : 0
          const y = constraintNow.enabled.y
            ? clamp(rawEuler.y * RAD2DEG, -yLimit, yLimit)
            : 0
          const z = constraintNow.enabled.z
            ? clamp(rawEuler.z * RAD2DEG, -zLimit, zLimit)
            : 0

          const constrainedDelta = new THREE.Quaternion().setFromEuler(
            new THREE.Euler((x / RAD2DEG), (y / RAD2DEG), (z / RAD2DEG), 'XYZ')
          )
          constrainedDeltaRef.current.copy(constrainedDelta)

          helper.quaternion.copy(startHelperQuatRef.current).multiply(constrainedDelta)
          bone.quaternion.copy(startBoneQuatRef.current).multiply(constrainedDelta).normalize()
          updateSkeleton(skeleton)
        }}
        onMouseUp={() => {
          if (!draggingRef.current) return
          draggingRef.current = false
          const helper = helperRef.current
          const boneName = activeBoneNameRef.current
          if (!helper || !boneName) return
          const ops = deltaToOps(
            constrainedDeltaRef.current,
            boneName,
            activeConstraintRef.current
          )
          pushPoseOps(ops)
        }}
      />
    </>
  )
}

