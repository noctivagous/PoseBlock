'use client'

import { TransformControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { PoseOp } from '../lib/poseCompose'
import {
  constraintForBone,
  DEFAULT_JOINT_CONSTRAINT,
  type JointConstraint,
} from '../lib/poseJointConstraints'
import { canonicalBoneName, updateSkeleton } from '../lib/poses'
import { useStore } from '../lib/store'

const RAD2DEG = 180 / Math.PI
const MIN_COMMIT_DEGREES = 0.1
const JOINT_NAME_RE =
  /Hips|Spine|Chest|Neck|Head|Shoulder|Arm|ForeArm|Hand|UpLeg|Leg|Foot|Toe|Thumb|Index|Middle|Ring|Pinky/i

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function jointRadius(name: string): number {
  if (/Thumb|Index|Middle|Ring|Pinky/i.test(name)) return 0.017
  if (/Toe/i.test(name)) return 0.02
  if (/Hand|Foot/i.test(name)) return 0.024
  return 0.028
}

function deltaToOps(delta: THREE.Quaternion, bone: string): PoseOp[] {
  const euler = new THREE.Euler().setFromQuaternion(delta, 'XYZ')
  const x = euler.x * RAD2DEG
  const y = euler.y * RAD2DEG
  const z = euler.z * RAD2DEG
  const ops: PoseOp[] = []
  if (Math.abs(x) >= MIN_COMMIT_DEGREES) ops.push({ type: 'rotateBone', bone, axis: 'x', degrees: x })
  if (Math.abs(y) >= MIN_COMMIT_DEGREES) ops.push({ type: 'rotateBone', bone, axis: 'y', degrees: y })
  if (Math.abs(z) >= MIN_COMMIT_DEGREES) ops.push({ type: 'rotateBone', bone, axis: 'z', degrees: z })
  return ops
}

function JointHandle({
  bone,
  selected,
  radius,
  onSelect,
}: {
  bone: THREE.Bone
  selected: boolean
  radius: number
  onSelect: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const worldPosRef = useRef(new THREE.Vector3())

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    bone.getWorldPosition(worldPosRef.current)
    mesh.parent?.worldToLocal(worldPosRef.current)
    mesh.position.copy(worldPosRef.current)
  })

  return (
    <mesh
      ref={meshRef}
      renderOrder={10}
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      <sphereGeometry args={[radius, 14, 14]} />
      <meshBasicMaterial
        color={selected ? '#ff4d8f' : '#22d3ee'}
        transparent
        opacity={selected ? 0.8 : 0.45}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

export function PoseJointSphereGizmo({
  skeleton,
  fitScale,
}: {
  skeleton: THREE.Skeleton
  fitScale: number
}) {
  const interactionMode = useStore((s) => s.interactionMode)
  const selectedPoseBone = useStore((s) => s.selectedPoseBone)
  const pushPoseOps = useStore((s) => s.pushPoseOps)
  const set = useStore((s) => s.set)

  const helperRef = useRef<THREE.Group>(null)
  const draggingRef = useRef(false)
  const startBoneQuatRef = useRef(new THREE.Quaternion())
  const startHelperQuatRef = useRef(new THREE.Quaternion())
  const constrainedDeltaRef = useRef(new THREE.Quaternion())
  const selectedBoneRef = useRef<THREE.Bone | null>(null)
  const selectedConstraintRef = useRef<JointConstraint>(DEFAULT_JOINT_CONSTRAINT)
  const worldPosRef = useRef(new THREE.Vector3())
  const worldQuatRef = useRef(new THREE.Quaternion())
  const parentQuatRef = useRef(new THREE.Quaternion())
  const localQuatRef = useRef(new THREE.Quaternion())

  const joints = useMemo(() => {
    return skeleton.bones.filter((bone) => {
      const name = canonicalBoneName(bone.name)
      if (!name) return false
      if (name.endsWith('_End') || name.endsWith('End')) return false
      return JOINT_NAME_RE.test(name)
    })
  }, [skeleton])

  const selectedBone = useMemo(() => {
    if (!selectedPoseBone) return null
    return (
      joints.find((bone) => canonicalBoneName(bone.name) === selectedPoseBone) ??
      skeleton.getBoneByName(selectedPoseBone) ??
      null
    )
  }, [joints, selectedPoseBone, skeleton])

  const selectedConstraint = useMemo(
    () =>
      selectedBone
        ? constraintForBone(canonicalBoneName(selectedBone.name))
        : DEFAULT_JOINT_CONSTRAINT,
    [selectedBone],
  )

  useEffect(() => {
    selectedBoneRef.current = selectedBone
    selectedConstraintRef.current = selectedConstraint
  }, [selectedBone, selectedConstraint])

  useEffect(() => {
    if (selectedPoseBone && !selectedBone) {
      set({ selectedPoseBone: null })
    }
  }, [selectedPoseBone, selectedBone, set])

  useFrame(() => {
    const helper = helperRef.current
    const bone = selectedBoneRef.current
    if (!helper || !bone || draggingRef.current) return

    bone.getWorldPosition(worldPosRef.current)
    helper.parent?.worldToLocal(worldPosRef.current)
    helper.position.copy(worldPosRef.current)

    bone.getWorldQuaternion(worldQuatRef.current)
    if (helper.parent) {
      helper.parent.getWorldQuaternion(parentQuatRef.current)
      localQuatRef.current
        .copy(parentQuatRef.current)
        .invert()
        .multiply(worldQuatRef.current)
      helper.quaternion.copy(localQuatRef.current)
    } else {
      helper.quaternion.copy(worldQuatRef.current)
    }
  })

  if (interactionMode !== 'pose') return null

  const localRadiusScale = fitScale > 0 ? 1 / fitScale : 1

  return (
    <group>
      {joints.map((bone) => {
        const name = canonicalBoneName(bone.name)
        return (
          <JointHandle
            key={bone.uuid}
            bone={bone}
            radius={jointRadius(name) * localRadiusScale}
            selected={selectedPoseBone === name}
            onSelect={() => set({ selectedPoseBone: name, selectedBodyPart: null })}
          />
        )
      })}

      {selectedBone && (
        <group ref={helperRef}>
          <TransformControls
            object={helperRef as unknown as { current: THREE.Object3D }}
            mode="rotate"
            space="local"
            size={0.45}
            onMouseDown={() => {
              const bone = selectedBoneRef.current
              const helper = helperRef.current
              if (!helper) return
              if (!bone) return
              draggingRef.current = true
              startBoneQuatRef.current.copy(bone.quaternion)
              startHelperQuatRef.current.copy(helper.quaternion)
              constrainedDeltaRef.current.identity()
            }}
            onObjectChange={() => {
              if (!draggingRef.current) return
              const bone = selectedBoneRef.current
              const helper = helperRef.current
              if (!bone || !helper) return

              const rawDelta = new THREE.Quaternion()
                .copy(startHelperQuatRef.current)
                .invert()
                .multiply(helper.quaternion)
              const rawEuler = new THREE.Euler().setFromQuaternion(rawDelta, 'XYZ')
              const constraint = selectedConstraintRef.current

              const x = constraint.enabled.x
                ? clamp(
                    rawEuler.x * RAD2DEG,
                    constraint.limitsDeg.x.min,
                    constraint.limitsDeg.x.max,
                  )
                : 0
              const y = constraint.enabled.y
                ? clamp(
                    rawEuler.y * RAD2DEG,
                    constraint.limitsDeg.y.min,
                    constraint.limitsDeg.y.max,
                  )
                : 0
              const z = constraint.enabled.z
                ? clamp(
                    rawEuler.z * RAD2DEG,
                    constraint.limitsDeg.z.min,
                    constraint.limitsDeg.z.max,
                  )
                : 0

              const constrainedDelta = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(x / RAD2DEG, y / RAD2DEG, z / RAD2DEG, 'XYZ'),
              )
              constrainedDeltaRef.current.copy(constrainedDelta)

              helper.quaternion.copy(startHelperQuatRef.current).multiply(constrainedDelta)
              bone.quaternion.copy(startBoneQuatRef.current).multiply(constrainedDelta).normalize()

              updateSkeleton(skeleton)
            }}
            onMouseUp={() => {
              if (!draggingRef.current) return
              draggingRef.current = false

              const bone = selectedBoneRef.current
              if (!bone) return

              const ops = deltaToOps(constrainedDeltaRef.current, canonicalBoneName(bone.name))
              pushPoseOps(ops)
            }}
            showX={selectedConstraint.enabled.x}
            showY={selectedConstraint.enabled.y}
            showZ={selectedConstraint.enabled.z}
          />
        </group>
      )}
    </group>
  )
}
