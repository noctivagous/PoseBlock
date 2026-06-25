'use client'

import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import {
  dollyAnchor,
  rotateMannequinYawAroundModelCenter,
  type MannequinPivotOffsets,
} from '../lib/characterTransform'
import { clampMannequinScale } from '../lib/framing'
import type { CharacterInstance } from '../lib/instances'
import { useStore } from '../lib/store'

const ROT_STEP = 15
const PITCH_STEP = 12
const TILT_STEP = 12
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

export type TransformGizmoControlsProps = {
  size?: THREE.Vector3
  /** When set, anchor positions follow this ref each frame (group selection). */
  sizeRef?: React.RefObject<THREE.Vector3>
  rotateLeft: () => void
  rotateRight: () => void
  dollyIn: () => void
  dollyOut: () => void
  pitchUp: () => void
  pitchDown: () => void
  tiltLeft: () => void
  tiltRight: () => void
  onScalePointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void
  onScalePointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void
  endScaleDrag: (e: React.PointerEvent<HTMLButtonElement>) => void
}

const GIZMO_PAD = 0.18

function updateGizmoAnchors(
  size: THREE.Vector3,
  top: THREE.Group | null,
  bottom: THREE.Group | null,
) {
  const halfY = size.y / 2
  top?.position.set(0, halfY + GIZMO_PAD * 1.6, 0)
  bottom?.position.set(0, -halfY - GIZMO_PAD, 0)
}

export function TransformGizmoControls({
  size,
  sizeRef,
  rotateLeft,
  rotateRight,
  dollyIn,
  dollyOut,
  pitchUp,
  pitchDown,
  tiltLeft,
  tiltRight,
  onScalePointerDown,
  onScalePointerMove,
  endScaleDrag,
}: TransformGizmoControlsProps) {
  const topRef = useRef<THREE.Group>(null)
  const bottomRef = useRef<THREE.Group>(null)

  useLayoutEffect(() => {
    if (size) updateGizmoAnchors(size, topRef.current, bottomRef.current)
  }, [size])

  useFrame(() => {
    if (sizeRef?.current) {
      updateGizmoAnchors(sizeRef.current, topRef.current, bottomRef.current)
    }
  })

  return (
    <>
      <group ref={topRef}>
        <Html center style={{ pointerEvents: 'auto' }}>
          <div className="flex flex-col items-center gap-1">
            <div className="relative">
              <div className="flex gap-1">
                <GizmoBtn label="↻" title="Rotate left" onClick={rotateLeft} />
                <GizmoBtn label="↺" title="Rotate right" onClick={rotateRight} />
              </div>
              <button
                type="button"
                title="Drag up/down to scale"
                className="absolute left-full top-0 ml-1 flex h-5 flex-col items-center justify-center gap-0 rounded-none border border-cyan-300/80 bg-cyan-900/80 px-1 py-0 text-[8px] leading-none text-cyan-100 shadow hover:bg-cyan-800/90"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onScalePointerDown(e)
                }}
                onPointerMove={onScalePointerMove}
                onPointerUp={endScaleDrag}
                onPointerCancel={endScaleDrag}
              >
                <span>scale</span>
                <span>(drag)</span>
              </button>
            </div>
            <div className="flex gap-1">
              <GizmoBtn label="↑" title="Move closer (larger)" onClick={dollyIn} />
              <GizmoBtn label="↓" title="Move farther (smaller)" onClick={dollyOut} />
            </div>
          </div>
        </Html>
      </group>

      <group ref={bottomRef}>
        <Html center style={{ pointerEvents: 'auto' }}>
          <div className="relative">
            <div className="flex gap-1">
              <GizmoBtn label="P+" title="Pitch toward camera" onClick={pitchUp} />
              <GizmoBtn label="P-" title="Pitch feet toward camera" onClick={pitchDown} />
            </div>
            <div className="absolute right-full top-0 mr-1">
              <GizmoBtn label="↙" title="Tilt left" onClick={tiltLeft} />
            </div>
            <div className="absolute left-full top-0 ml-1">
              <GizmoBtn label="↘" title="Tilt right" onClick={tiltRight} />
            </div>
          </div>
        </Html>
      </group>
    </>
  )
}

type BoundingBoxGizmoProps = {
  instanceId: string
  size: THREE.Vector3
  center: THREE.Vector3
  pivots: MannequinPivotOffsets
}

export function BoundingBoxGizmo({ instanceId, size, center, pivots }: BoundingBoxGizmoProps) {
  const instance = useStore((s) => s.instances.find((i) => i.id === instanceId))
  const frameWidth = useStore((s) => s.frameWidth)
  const frameHeight = useStore((s) => s.frameHeight)
  const updateInstance = useStore((s) => s.updateInstance)
  const scaleDrag = useRef<{ startScale: number; startY: number; pointerId: number } | null>(
    null,
  )

  if (!instance) return null

  const patch = (partial: Partial<CharacterInstance>) => updateInstance(instanceId, partial)

  const rotateYaw = (deltaRotationDeg: number) => {
    if (!instance) return
    patch(
      rotateMannequinYawAroundModelCenter({
        x: instance.x,
        y: instance.y,
        scale: instance.scale,
        rotation: instance.rotation,
        characterZ: instance.characterZ,
        characterRotationX: instance.characterRotationX,
        characterRotationZ: instance.characterRotationZ,
        modelCenter: pivots.modelCenter,
        feetFromYawNeg: pivots.feetFromYawNeg,
        deltaRotationDeg,
        frameWidth,
        frameHeight,
      }),
    )
  }

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
      <mesh raycast={() => null} scale={[size.x, size.y, size.z]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color="#38bdf8"
          wireframe
          transparent
          opacity={0.85}
          depthTest={false}
        />
      </mesh>

      <TransformGizmoControls
        size={size}
        rotateLeft={() => rotateYaw(-ROT_STEP)}
        rotateRight={() => rotateYaw(ROT_STEP)}
        dollyIn={() => patch(dollyAnchor({ scale: instance.scale }, instance.characterZ, 1))}
        dollyOut={() => patch(dollyAnchor({ scale: instance.scale }, instance.characterZ, -1))}
        pitchUp={() =>
          patch({
            characterRotationX: clamp(
              instance.characterRotationX + PITCH_STEP,
              -MAX_PITCH,
              MAX_PITCH,
            ),
          })
        }
        pitchDown={() =>
          patch({
            characterRotationX: clamp(
              instance.characterRotationX - PITCH_STEP,
              -MAX_PITCH,
              MAX_PITCH,
            ),
          })
        }
        tiltLeft={() =>
          patch({ characterRotationZ: instance.characterRotationZ + TILT_STEP })
        }
        tiltRight={() =>
          patch({ characterRotationZ: instance.characterRotationZ - TILT_STEP })
        }
        onScalePointerDown={onScalePointerDown}
        onScalePointerMove={onScalePointerMove}
        endScaleDrag={endScaleDrag}
      />
    </group>
  )
}
