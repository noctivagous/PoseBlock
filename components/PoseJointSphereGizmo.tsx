'use client'

import { TransformControls } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
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
const DRAG_TO_DEGREES = 0.35
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
  boneName,
  selected,
  radius,
  onSelect,
  onDragRotateStart,
  onDragRotate,
  onDragRotateEnd,
}: {
  bone: THREE.Bone
  boneName: string
  selected: boolean
  radius: number
  onSelect: () => void
  onDragRotateStart: (boneName: string, e: ThreeEvent<PointerEvent>) => void
  onDragRotate: (boneName: string, e: ThreeEvent<PointerEvent>) => void
  onDragRotateEnd: (boneName: string, e: ThreeEvent<PointerEvent>) => void
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
        onDragRotateStart(boneName, e)
      }}
      onPointerMove={(e) => {
        onDragRotate(boneName, e)
      }}
      onPointerUp={(e) => {
        onDragRotateEnd(boneName, e)
      }}
      onPointerCancel={(e) => {
        onDragRotateEnd(boneName, e)
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

  const draggingRef = useRef(false)
  const startBoneQuatRef = useRef(new THREE.Quaternion())
  const constrainedDeltaRef = useRef(new THREE.Quaternion())
  const selectedBoneRef = useRef<THREE.Bone | null>(null)
  const selectedConstraintRef = useRef<JointConstraint>(DEFAULT_JOINT_CONSTRAINT)
  const dragRef = useRef<{ pointerId: number; boneName: string; startX: number; startY: number } | null>(null)

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

  if (interactionMode !== 'pose') return null

  const localRadiusScale = fitScale > 0 ? 1 / fitScale : 1

  const beginSphereDrag = (boneName: string, e: ThreeEvent<PointerEvent>) => {
    const bone = joints.find((b) => canonicalBoneName(b.name) === boneName)
    if (!bone) return
    e.stopPropagation()
    dragRef.current = {
      pointerId: e.pointerId,
      boneName,
      startX: e.clientX,
      startY: e.clientY,
    }
    draggingRef.current = true
    selectedBoneRef.current = bone
    selectedConstraintRef.current = constraintForBone(boneName)
    startBoneQuatRef.current.copy(bone.quaternion)
    constrainedDeltaRef.current.identity()
    ;(e.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId)
  }

  const moveSphereDrag = (boneName: string, e: ThreeEvent<PointerEvent>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId || drag.boneName !== boneName) return
    const bone = selectedBoneRef.current
    if (!bone) return
    e.stopPropagation()

    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    const constraint = selectedConstraintRef.current

    const x = constraint.enabled.x
      ? clamp(dy * DRAG_TO_DEGREES, constraint.limitsDeg.x.min, constraint.limitsDeg.x.max)
      : 0
    const y = constraint.enabled.y
      ? clamp(dx * DRAG_TO_DEGREES, constraint.limitsDeg.y.min, constraint.limitsDeg.y.max)
      : 0
    const z = 0

    const constrainedDelta = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(x / RAD2DEG, y / RAD2DEG, z / RAD2DEG, 'XYZ'),
    )
    constrainedDeltaRef.current.copy(constrainedDelta)
    bone.quaternion.copy(startBoneQuatRef.current).multiply(constrainedDelta).normalize()
    updateSkeleton(skeleton)
  }

  const endSphereDrag = (boneName: string, e: ThreeEvent<PointerEvent>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId || drag.boneName !== boneName) return
    e.stopPropagation()
    draggingRef.current = false
    dragRef.current = null

    const ops = deltaToOps(constrainedDeltaRef.current, boneName)
    pushPoseOps(ops)

    ;(e.target as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(e.pointerId)
  }

  return (
    <group>
      {joints.map((bone) => {
        const name = canonicalBoneName(bone.name)
        return (
          <JointHandle
            key={bone.uuid}
            bone={bone}
            boneName={name}
            radius={jointRadius(name) * localRadiusScale}
            selected={selectedPoseBone === name}
            onSelect={() => set({ selectedPoseBone: name, selectedBodyPart: null })}
            onDragRotateStart={beginSphereDrag}
            onDragRotate={moveSphereDrag}
            onDragRotateEnd={endSphereDrag}
          />
        )
      })}

      {selectedBone && (
        <TransformControls
          key={selectedBone.uuid}
          object={selectedBone}
          mode="rotate"
          space="local"
          size={0.45}
          onMouseDown={() => {
            const bone = selectedBoneRef.current
            if (!bone) return
            draggingRef.current = true
            startBoneQuatRef.current.copy(bone.quaternion)
            constrainedDeltaRef.current.identity()
          }}
          onObjectChange={() => {
            if (!draggingRef.current) return
            const bone = selectedBoneRef.current
            if (!bone) return

            const rawDelta = new THREE.Quaternion()
              .copy(startBoneQuatRef.current)
              .invert()
              .multiply(bone.quaternion)
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
      )}
    </group>
  )
}
