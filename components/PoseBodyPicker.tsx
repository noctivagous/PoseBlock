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
    case 'stance':
      return [stanceNudge(clamp(dx * 0.1, -8, 8))]
    case 'whole':
      return [wholeRotate('y', yaw), wholeRotate('x', pitch)]
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
  onSelect: () => void
  onDragAdjust: (partId: BodyPartId, dx: number, dy: number) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const dragStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    dragging: boolean
  } | null>(null)

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    bone.getWorldPosition(_worldPos)
    mesh.parent?.worldToLocal(_worldPos)
    mesh.position.copy(_worldPos)
  })

  return (
    <mesh
      ref={meshRef}
      renderOrder={10}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        onSelect()
        dragStateRef.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          dragging: false,
        }
        ;(e.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
          e.pointerId
        )
      }}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        const drag = dragStateRef.current
        if (!drag || drag.pointerId !== e.pointerId) return
        const dx = e.clientX - drag.startX
        const dy = e.clientY - drag.startY
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          drag.dragging = true
        }
      }}
      onPointerUp={(e: ThreeEvent<PointerEvent>) => {
        const drag = dragStateRef.current
        if (!drag || drag.pointerId !== e.pointerId) return
        e.stopPropagation()
        const dx = e.clientX - drag.startX
        const dy = e.clientY - drag.startY
        if (drag.dragging) {
          onDragAdjust(partId, dx, dy)
        }
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
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
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
            onSelect={() => set({ selectedBodyPart: part.id })}
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
