'use client'

import { Html } from '@react-three/drei'
import { useRef } from 'react'
import * as THREE from 'three'
import {
  clampCharacterZ,
  Z_STEP,
} from '@/lib/characterTransform'
import { useStore } from '@/lib/store'

const ROT_STEP = 15
const PITCH_STEP = 12
const MAX_PITCH = 160
const MIN_SCALE = 0.15
const MAX_SCALE = 4
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

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
  const scaleDrag = useRef<{ startScale: number; startY: number; pointerId: number } | null>(
    null
  )

  const halfX = size.x / 2
  const halfY = size.y / 2
  const pad = 0.18

  const rotateLeft = () =>
    set({ characterRotationY: useStore.getState().characterRotationY - ROT_STEP })
  const rotateRight = () =>
    set({ characterRotationY: useStore.getState().characterRotationY + ROT_STEP })
  const pitchTowardCamera = () =>
    set({
      characterRotationX: clamp(
        useStore.getState().characterRotationX + PITCH_STEP,
        -MAX_PITCH,
        MAX_PITCH
      ),
    })
  const pitchFeetTowardCamera = () =>
    set({
      characterRotationX: clamp(
        useStore.getState().characterRotationX - PITCH_STEP,
        -MAX_PITCH,
        MAX_PITCH
      ),
    })
  const moveTowardCamera = () => {
    const z = clampCharacterZ(useStore.getState().characterZ + Z_STEP)
    set({ characterZ: z })
  }
  const moveAwayFromCamera = () => {
    const z = clampCharacterZ(useStore.getState().characterZ - Z_STEP)
    set({ characterZ: z })
  }

  const onScalePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    scaleDrag.current = {
      startScale: characterScale,
      startY: e.clientY,
      pointerId: e.pointerId,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onScalePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!scaleDrag.current || scaleDrag.current.pointerId !== e.pointerId) return
    e.stopPropagation()
    const delta = (scaleDrag.current.startY - e.clientY) * 0.008
    const next = THREE.MathUtils.clamp(
      scaleDrag.current.startScale + delta,
      MIN_SCALE,
      MAX_SCALE
    )
    set({ characterScale: next })
  }

  const endScaleDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!scaleDrag.current || scaleDrag.current.pointerId !== e.pointerId) return
    e.stopPropagation()
    scaleDrag.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
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

      {/* Pitch: head/feet toward camera (separate lane to avoid overlap) */}
      <Html
        position={[-halfX - pad, -halfY * 0.25, 0]}
        center
        style={{ pointerEvents: 'auto' }}
      >
        <div className="flex gap-1">
          <GizmoBtn
            label="P+"
            title="Pitch toward camera (flying)"
            onClick={pitchTowardCamera}
          />
          <GizmoBtn
            label="P-"
            title="Pitch opposite direction (feet toward camera)"
            onClick={pitchFeetTowardCamera}
          />
        </div>
      </Html>

      {/* Scale handle — HTML button with drag-to-scale */}
      <Html position={[halfX + 0.34, -halfY * 0.22, 0]} center style={{ pointerEvents: 'auto' }}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Drag up/down to scale"
            className="flex h-5 w-5 items-center justify-center rounded border border-cyan-300/80 bg-cyan-900/80 text-[10px] leading-none text-cyan-100 shadow hover:bg-cyan-800/90"
            onPointerDown={onScalePointerDown}
            onPointerMove={onScalePointerMove}
            onPointerUp={endScaleDrag}
            onPointerCancel={endScaleDrag}
          >
            S
          </button>
          <span className="pointer-events-none select-none text-[10px] text-sky-200">scale</span>
        </div>
      </Html>
    </group>
  )
}
