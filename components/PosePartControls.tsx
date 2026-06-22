'use client'

import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { bodyPartById, type BodyPartId } from '@/lib/bodyParts'
import { opsForBodyPart } from '@/lib/poseAdjustmentActions'
import { findSkeletonBone } from '@/lib/poses'
import { useStore } from '@/lib/store'

const _worldPos = new THREE.Vector3()

function ControlBtn({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] text-white/90 hover:bg-zinc-700"
    >
      {label}
    </button>
  )
}

function PartPanel({ partId }: { partId: BodyPartId }) {
  const pushPoseOp = useStore((s) => s.pushPoseOp)
  const set = useStore((s) => s.set)
  const part = bodyPartById(partId)

  const apply = (action: string) => {
    const op = opsForBodyPart(partId, action)
    if (op) pushPoseOp(op)
  }

  const rows = useMemo(() => {
    switch (partId) {
      case 'head':
      case 'whole':
        return [
          ['Pitch −', 'pitch-'],
          ['Pitch +', 'pitch+'],
          ['Yaw −', 'yaw-'],
          ['Yaw +', 'yaw+'],
          ['Roll −', 'roll-'],
          ['Roll +', 'roll+'],
        ] as const
      case 'torso':
        return [
          ['Lean back', 'pitch-'],
          ['Lean fwd', 'pitch+'],
          ['Turn L', 'yaw+'],
          ['Turn R', 'yaw-'],
        ] as const
      case 'leftArm':
      case 'rightArm':
        return [
          ['Raise', 'raise+'],
          ['Lower', 'raise-'],
          ['Out', 'out+'],
          ['In', 'out-'],
          ['Bend +', 'fore+'],
          ['Bend −', 'fore-'],
        ] as const
      case 'leftHand':
      case 'rightHand':
        return [
          ['Point', 'point'],
          ['Fist', 'fist'],
          ['Open', 'open'],
        ] as const
      case 'stance':
        return [
          ['Wider', 'wide+'],
          ['Narrower', 'wide-'],
        ] as const
      default:
        return []
    }
  }, [partId])

  return (
    <div
      className="flex w-36 flex-col gap-1.5 rounded-lg border border-white/10 bg-black/85 p-1.5 text-white shadow-lg backdrop-blur"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium">{part.label}</span>
        <button
          type="button"
          onClick={() => set({ selectedBodyPart: null })}
          className="text-[11px] text-white/50 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {rows.map(([label, action]) => (
          <ControlBtn key={action} label={label} onClick={() => apply(action)} />
        ))}
      </div>
    </div>
  )
}

export function PosePartControls({ skeleton }: { skeleton: THREE.Skeleton }) {
  const interactionMode = useStore((s) => s.interactionMode)
  const selectedBodyPart = useStore((s) => s.selectedBodyPart)
  const groupRef = useRef<THREE.Group>(null)

  const bone = selectedBodyPart
    ? findSkeletonBone(skeleton, bodyPartById(selectedBodyPart).pickBone)
    : null

  useFrame(() => {
    const group = groupRef.current
    if (!group || !bone) return
    bone.getWorldPosition(_worldPos)
    group.parent?.worldToLocal(_worldPos)
    group.position.copy(_worldPos)
    group.position.y += 0.25
  })

  if (interactionMode !== 'pose' || !selectedBodyPart || !bone) return null

  return (
    <group ref={groupRef}>
      <Html center transform={false} distanceFactor={1} style={{ pointerEvents: 'auto' }}>
        <PartPanel partId={selectedBodyPart} />
      </Html>
    </group>
  )
}
