'use client'

import { useRef } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { dollyAnchor } from '../lib/characterTransform'
import { clampMannequinScale } from '../lib/framing'
import { useStore } from '../lib/store'

const ROT_STEP = 15
const PITCH_STEP = 12
const MAX_PITCH = 160
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
  instanceId: string
  size: THREE.Vector3
  center: THREE.Vector3
}

export function BoundingBoxGizmo({ instanceId, size, center }: BoundingBoxGizmoProps) {
  const instance = useStore((s) => s.instances.find((i) => i.id === instanceId))
  const updateInstance = useStore((s) => s.updateInstance)
  const scaleDrag = useRef<{ startScale: number; startY: number; pointerId: number } | null>(
    null,
  )

  if (!instance) return null

  const patch = (partial: Parameters<typeof updateInstance>[1]) =>
    updateInstance(instanceId, partial)

  const halfY = size.y / 2
  const pad = 0.18

  const onScalePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    scaleDrag.current = {
      startScale: instance.scale,
      startY: e.clientY,
      pointerId: e.pointerId,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onScalePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!scaleDrag.current || scaleDrag.current.pointerId !== e.pointerId) return
    e.stopPropagation()
    const delta = (scaleDrag.current.startY - e.clientY) * 0.008
    patch({ scale: clampMannequinScale(scaleDrag.current.startScale + delta) })
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

      <Html position={[0, halfY + pad * 1.6, 0]} center style={{ pointerEvents: 'auto' }}>
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-1">
            <GizmoBtn
              label="↺"
              title="Rotate left"
              onClick={() => patch({ rotation: instance.rotation - ROT_STEP })}
            />
            <GizmoBtn
              label="↻"
              title="Rotate right"
              onClick={() => patch({ rotation: instance.rotation + ROT_STEP })}
            />
          </div>
          <div className="flex gap-1">
            <GizmoBtn
              label="↑"
              title="Move closer (larger)"
              onClick={() =>
                patch(
                  dollyAnchor({ scale: instance.scale }, instance.characterZ, 1),
                )
              }
            />
            <GizmoBtn
              label="↓"
              title="Move farther (smaller)"
              onClick={() =>
                patch(
                  dollyAnchor({ scale: instance.scale }, instance.characterZ, -1),
                )
              }
            />
          </div>
        </div>
      </Html>

      <Html position={[0, -halfY - pad, 0]} center style={{ pointerEvents: 'auto' }}>
        <div className="flex items-center gap-1">
          <GizmoBtn
            label="P+"
            title="Pitch toward camera"
            onClick={() =>
              patch({
                characterRotationX: clamp(
                  instance.characterRotationX + PITCH_STEP,
                  -MAX_PITCH,
                  MAX_PITCH,
                ),
              })
            }
          />
          <GizmoBtn
            label="P-"
            title="Pitch feet toward camera"
            onClick={() =>
              patch({
                characterRotationX: clamp(
                  instance.characterRotationX - PITCH_STEP,
                  -MAX_PITCH,
                  MAX_PITCH,
                ),
              })
            }
          />
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
