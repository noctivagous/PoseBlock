'use client'

import type { ThreeEvent } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { BODY_PARTS, type BodyPartId } from '../lib/bodyParts'
import {
  armNudge,
  headRotate,
  stanceNudge,
  torsoNudge,
  wholeRotate,
} from '../lib/poseAdjustmentActions'
import { findSkeletonBone } from '../lib/poses'
import { useStore } from '../lib/store'

const _worldPos = new THREE.Vector3()
const _worldQuat = new THREE.Quaternion()
const _parentQuat = new THREE.Quaternion()
const DRAG_TO_DEGREES = 0.25

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function dragOpsForPart(partId: BodyPartId, dx: number, dy: number) {
  const yaw = clamp(dx * DRAG_TO_DEGREES, -20, 20)
  const pitch = clamp(-dy * DRAG_TO_DEGREES, -20, 20)

  switch (partId) {
    case 'head':
      return [headRotate('y', yaw), headRotate('x', pitch)]
    case 'neck':
      return [
        { type: 'rotateBone' as const, bone: 'Neck', axis: 'y' as const, degrees: yaw },
        { type: 'rotateBone' as const, bone: 'Neck', axis: 'x' as const, degrees: pitch },
      ]
    case 'torso':
      return [torsoNudge(pitch, yaw)]
    case 'leftArm':
      return [armNudge('left', { out: yaw, raise: pitch })]
    case 'rightArm':
      return [armNudge('right', { out: yaw, raise: pitch })]
    case 'leftHand':
      return [
        { type: 'rotateBone' as const, bone: 'LeftHand', axis: 'y' as const, degrees: yaw },
        { type: 'rotateBone' as const, bone: 'LeftHand', axis: 'x' as const, degrees: pitch },
      ]
    case 'rightHand':
      return [
        { type: 'rotateBone' as const, bone: 'RightHand', axis: 'y' as const, degrees: yaw },
        { type: 'rotateBone' as const, bone: 'RightHand', axis: 'x' as const, degrees: pitch },
      ]
    case 'leftForeArm':
      return [
        { type: 'rotateBone' as const, bone: 'LeftForeArm', axis: 'y' as const, degrees: yaw },
        { type: 'rotateBone' as const, bone: 'LeftForeArm', axis: 'x' as const, degrees: pitch },
      ]
    case 'rightForeArm':
      return [
        { type: 'rotateBone' as const, bone: 'RightForeArm', axis: 'y' as const, degrees: yaw },
        { type: 'rotateBone' as const, bone: 'RightForeArm', axis: 'x' as const, degrees: pitch },
      ]
    case 'leftUpLeg':
      return [
        { type: 'rotateBone' as const, bone: 'LeftUpLeg', axis: 'y' as const, degrees: yaw },
        { type: 'rotateBone' as const, bone: 'LeftUpLeg', axis: 'x' as const, degrees: pitch },
      ]
    case 'rightUpLeg':
      return [
        { type: 'rotateBone' as const, bone: 'RightUpLeg', axis: 'y' as const, degrees: yaw },
        { type: 'rotateBone' as const, bone: 'RightUpLeg', axis: 'x' as const, degrees: pitch },
      ]
    case 'leftLeg':
      return [
        { type: 'rotateBone' as const, bone: 'LeftLeg', axis: 'x' as const, degrees: pitch },
        { type: 'rotateBone' as const, bone: 'LeftLeg', axis: 'y' as const, degrees: yaw },
      ]
    case 'rightLeg':
      return [
        { type: 'rotateBone' as const, bone: 'RightLeg', axis: 'x' as const, degrees: pitch },
        { type: 'rotateBone' as const, bone: 'RightLeg', axis: 'y' as const, degrees: yaw },
      ]
    case 'leftFoot':
      return [
        { type: 'rotateBone' as const, bone: 'LeftFoot', axis: 'x' as const, degrees: pitch },
        { type: 'rotateBone' as const, bone: 'LeftFoot', axis: 'y' as const, degrees: yaw },
      ]
    case 'rightFoot':
      return [
        { type: 'rotateBone' as const, bone: 'RightFoot', axis: 'x' as const, degrees: pitch },
        { type: 'rotateBone' as const, bone: 'RightFoot', axis: 'y' as const, degrees: yaw },
      ]
    case 'stance':
      return [stanceNudge(clamp(dx * 0.1, -8, 8))]
    case 'whole':
      return [wholeRotate('y', yaw), wholeRotate('x', pitch)]
    default:
      return []
  }
}

function PartPickerSphere({
  partId,
  bone,
  radius,
  selected,
  onSelect,
  onDragAdjust,
}: {
  partId: BodyPartId
  bone: THREE.Bone
  radius: number
  selected: boolean
  onSelect: (shiftKey: boolean) => boolean
  onDragAdjust: (partId: BodyPartId, dx: number, dy: number) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const dragStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    lastX: number
    lastY: number
    dragging: boolean
  } | null>(null)

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    bone.getWorldPosition(_worldPos)
    mesh.parent?.worldToLocal(_worldPos)
    mesh.position.copy(_worldPos)

    bone.getWorldQuaternion(_worldQuat)
    if (mesh.parent) {
      mesh.parent.getWorldQuaternion(_parentQuat)
      mesh.quaternion.copy(_parentQuat.invert().multiply(_worldQuat))
    }
  })

  return (
    <mesh
      ref={meshRef}
      renderOrder={10}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        const keepSelected = onSelect(e.nativeEvent.shiftKey)
        if (!keepSelected) return
        dragStateRef.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
          dragging: false,
        }
        ;(e.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
          e.pointerId
        )
      }}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        const drag = dragStateRef.current
        if (!drag || drag.pointerId !== e.pointerId) return
        const dx = e.clientX - drag.lastX
        const dy = e.clientY - drag.lastY
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          drag.dragging = true
          drag.lastX = e.clientX
          drag.lastY = e.clientY
          onDragAdjust(partId, dx, dy)
        }
      }}
      onPointerUp={(e: ThreeEvent<PointerEvent>) => {
        const drag = dragStateRef.current
        if (!drag || drag.pointerId !== e.pointerId) return
        e.stopPropagation()
        dragStateRef.current = null
        ;(e.target as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(
          e.pointerId
        )
      }}
      onPointerCancel={(e: ThreeEvent<PointerEvent>) => {
        dragStateRef.current = null
        ;(e.target as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(
          e.pointerId
        )
        e.stopPropagation()
      }}
    >
      <sphereGeometry args={[radius, 14, 14]} />
      <meshBasicMaterial
        color={selected ? '#38bdf8' : '#ffffff'}
        transparent
        opacity={selected ? 0.7 : 0.35}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
      <group>
        <mesh position={[radius * 0.7, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[radius * 0.06, radius * 0.06, radius * 1.4, 6]} />
          <meshBasicMaterial color="#ff6b6b" transparent opacity={selected ? 0.95 : 0.7} depthTest={false} />
        </mesh>
        <mesh position={[0, radius * 0.7, 0]}>
          <cylinderGeometry args={[radius * 0.06, radius * 0.06, radius * 1.4, 6]} />
          <meshBasicMaterial color="#4ade80" transparent opacity={selected ? 0.95 : 0.7} depthTest={false} />
        </mesh>
        <mesh position={[0, 0, radius * 0.7]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[radius * 0.06, radius * 0.06, radius * 1.4, 6]} />
          <meshBasicMaterial color="#60a5fa" transparent opacity={selected ? 0.95 : 0.7} depthTest={false} />
        </mesh>
      </group>
    </mesh>
  )
}

export function PoseBodyPicker({
  skeleton,
  fitScale,
}: {
  skeleton: THREE.Skeleton
  fitScale: number
}) {
  const interactionMode = useStore((s) => s.interactionMode)
  const selectedBodyPart = useStore((s) => s.selectedBodyPart)
  const primaryId = useStore((s) => s.selectedIds[0] ?? null)
  const selectInstance = useStore((s) => s.selectInstance)
  const pushPoseOp = useStore((s) => s.pushPoseOp)
  const set = useStore((s) => s.set)

  if (interactionMode !== 'pose') return null

  const localRadiusScale = fitScale > 0 ? 1 / fitScale : 1

  return (
    <group>
      {BODY_PARTS.map((part) => {
        const bone = findSkeletonBone(skeleton, part.pickBone)
        if (!bone) return null
        return (
          <PartPickerSphere
            key={part.id}
            partId={part.id}
            bone={bone}
            radius={part.pickRadius * localRadiusScale}
            selected={selectedBodyPart === part.id}
            onSelect={(shiftKey) => {
              if (primaryId) {
                if (shiftKey) {
                  selectInstance(primaryId, { shiftKey: true })
                  if (!useStore.getState().selectedIds.includes(primaryId)) {
                    set({ selectedBodyPart: null, selectedPoseBone: null })
                    return false
                  }
                } else {
                  selectInstance(primaryId)
                }
              }
              set({ selectedBodyPart: part.id, selectedPoseBone: null })
              return true
            }}
            onDragAdjust={(id, dx, dy) => {
              for (const op of dragOpsForPart(id, dx, dy)) {
                pushPoseOp(op)
              }
            }}
          />
        )
      })}
    </group>
  )
}
