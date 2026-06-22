'use client'

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { BODY_PARTS } from '@/lib/bodyParts'
import { findSkeletonBone } from '@/lib/poses'
import { useStore } from '@/lib/store'

const _worldPos = new THREE.Vector3()

function PartPickerSphere({
  bone,
  radius,
  selected,
  onSelect,
}: {
  bone: THREE.Bone
  radius: number
  selected: boolean
  onSelect: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)

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
            bone={bone}
            radius={part.pickRadius * localRadiusScale}
            selected={selectedBodyPart === part.id}
            onSelect={() => set({ selectedBodyPart: part.id })}
          />
        )
      })}
    </group>
  )
}
