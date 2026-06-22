'use client'

import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import {
  clampCharacterZ,
  Z_STEP,
} from '@/lib/characterTransform'
import { useStore } from '@/lib/store'

const ROT_STEP = 15
const MIN_SCALE = 0.15
const MAX_SCALE = 4

function GizmoBtn({
  label,
  title,
  onClick,
}: {
  label: string
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="flex h-5 w-5 items-center justify-center rounded border border-sky-400/60 bg-black/80 text-[10px] leading-none text-sky-200 shadow hover:bg-sky-900/80"
    >
      {label}
    </button>
  )
}

type BoundingBoxGizmoProps = {
  size: THREE.Vector3
  center: THREE.Vector3
}

export function BoundingBoxGizmo({ size, center }: BoundingBoxGizmoProps) {
  const set = useStore((s) => s.set)
  const characterScale = useStore((s) => s.characterScale)
  const scaleDrag = useRef<{ startScale: number; startY: number } | null>(null)

  const halfX = size.x / 2
  const halfY = size.y / 2
  const pad = 0.18

  const rotateLeft = () =>
    set({ characterRotationY: useStore.getState().characterRotationY - ROT_STEP })
  const rotateRight = () =>
    set({ characterRotationY: useStore.getState().characterRotationY + ROT_STEP })
  const moveTowardCamera = () => {
    const z = clampCharacterZ(useStore.getState().characterZ + Z_STEP)
    set({ characterZ: z })
  }
  const moveAwayFromCamera = () => {
    const z = clampCharacterZ(useStore.getState().characterZ - Z_STEP)
    set({ characterZ: z })
  }

  const onScalePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    scaleDrag.current = { startScale: characterScale, startY: e.clientY }
    ;(e.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
      e.pointerId
    )
  }

  const onScalePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!scaleDrag.current) return
    e.stopPropagation()
    const delta = (scaleDrag.current.startY - e.clientY) * 0.008
    const next = THREE.MathUtils.clamp(
      scaleDrag.current.startScale + delta,
      MIN_SCALE,
      MAX_SCALE
    )
    set({ characterScale: next })
  }

  const endScaleDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!scaleDrag.current) return
    e.stopPropagation()
    scaleDrag.current = null
    ;(e.target as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(
      e.pointerId
    )
  }

  return (
    <group position={center}>
      <mesh scale={[size.x, size.y, size.z]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color="#38bdf8"
          wireframe
          transparent
          opacity={0.85}
          depthTest={false}
        />
      </mesh>

      {/* Rotate left */}
      <Html position={[-halfX - pad, halfY * 0.25, 0]} center style={{ pointerEvents: 'auto' }}>
        <GizmoBtn label="↺" title="Rotate left" onClick={rotateLeft} />
      </Html>

      {/* Rotate right */}
      <Html position={[halfX + pad, halfY * 0.25, 0]} center style={{ pointerEvents: 'auto' }}>
        <GizmoBtn label="↻" title="Rotate right" onClick={rotateRight} />
      </Html>

      {/* Depth: closer / farther */}
      <Html position={[0, halfY + pad, 0]} center style={{ pointerEvents: 'auto' }}>
        <div className="flex gap-1">
          <GizmoBtn label="↑" title="Move closer (larger)" onClick={moveTowardCamera} />
          <GizmoBtn label="↓" title="Move farther (smaller)" onClick={moveAwayFromCamera} />
        </div>
      </Html>

      {/* Scale handle — bottom-right corner */}
      <mesh
        position={[halfX, -halfY, 0.02]}
        renderOrder={20}
        onPointerDown={onScalePointerDown}
        onPointerMove={onScalePointerMove}
        onPointerUp={endScaleDrag}
        onPointerCancel={endScaleDrag}
      >
        <boxGeometry args={[0.14, 0.14, 0.14]} />
        <meshBasicMaterial color="#38bdf8" depthTest={false} toneMapped={false} />
      </mesh>
      <Html position={[halfX + 0.12, -halfY - 0.12, 0]} center>
        <span className="pointer-events-none select-none text-[10px] text-sky-300/80">
          resize
        </span>
      </Html>
    </group>
  )
}
