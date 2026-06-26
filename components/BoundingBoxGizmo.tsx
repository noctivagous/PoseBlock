'use client'

import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import {
  clampGroupWorldToView,
  orthoViewBounds,
  type ControlExtentsPx,
} from '../lib/gizmoFrameClamp'
import {
  dollyAnchor,
  rotateMannequinYawAroundModelCenter,
  type MannequinPivotOffsets,
} from '../lib/characterTransform'
import { clampMannequinAnchor, clampMannequinScale, maxFeetAnchorY } from '../lib/framing'
import type { CharacterInstance } from '../lib/instances'
import { registerSelectionBounds } from '../lib/selectionBoundsRegistry'
import { useStore } from '../lib/store'

const ROT_STEP = 15
const PITCH_STEP = 12
const TILT_STEP = 12
const MAX_PITCH = 160
const ROTATE_Y_DRAG_SENSITIVITY = 0.35
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

type DragGizmoHandlers = {
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void
  endDrag: (e: React.PointerEvent<HTMLButtonElement>) => void
}

function DragGizmoBtn({
  label,
  title,
  onPointerDown,
  onPointerMove,
  endDrag,
}: {
  label: string
  title: string
} & DragGizmoHandlers) {
  return (
    <button
      type="button"
      title={title}
      className="flex h-5 flex-col items-center justify-center gap-0 rounded-none border border-cyan-300/80 bg-cyan-900/80 px-1 py-0 text-[8px] leading-none text-cyan-100 shadow hover:bg-cyan-800/90"
      onPointerDown={(e) => {
        e.stopPropagation()
        onPointerDown(e)
      }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <span>{label}</span>
      <span>(drag)</span>
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
  scaleDrag: DragGizmoHandlers
  moveDrag: DragGizmoHandlers
  rotateYDrag: DragGizmoHandlers
}

const GIZMO_PAD = 0.18

/** Approximate Html cluster size (px) for frame clamping — rotate row + drag column + dolly row. */
const TOP_CONTROLS_EXTENTS: ControlExtentsPx = { width: 112, height: 72 }
/** Pitch row + tilt buttons flanking. */
const BOTTOM_CONTROLS_EXTENTS: ControlExtentsPx = { width: 132, height: 24 }

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
  scaleDrag,
  moveDrag,
  rotateYDrag,
}: TransformGizmoControlsProps) {
  const topRef = useRef<THREE.Group>(null)
  const bottomRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    const boxSize = sizeRef?.current ?? size
    if (!boxSize) return

    updateGizmoAnchors(boxSize, topRef.current, bottomRef.current)

    const aspect = state.size.width / state.size.height || 16 / 9
    const bounds = orthoViewBounds(aspect)
    const canvasHeight = state.size.height

    if (topRef.current) {
      clampGroupWorldToView(topRef.current, TOP_CONTROLS_EXTENTS, bounds, canvasHeight)
    }
    if (bottomRef.current) {
      clampGroupWorldToView(bottomRef.current, BOTTOM_CONTROLS_EXTENTS, bounds, canvasHeight)
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
              <div className="absolute left-full top-0 ml-1 flex flex-col gap-1">
                <DragGizmoBtn
                  label="scale"
                  title="Drag up/down to scale"
                  {...scaleDrag}
                />
                <DragGizmoBtn
                  label="move"
                  title="Drag to move"
                  {...moveDrag}
                />
                <DragGizmoBtn
                  label="rotate y"
                  title="Drag left/right to rotate around Y"
                  {...rotateYDrag}
                />
              </div>
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
  showControls?: boolean
  wireframeColor?: string
  wireframeOpacity?: number
}

export function BoundingBoxGizmo({
  instanceId,
  size,
  center,
  pivots,
  showControls = true,
  wireframeColor = '#38bdf8',
  wireframeOpacity = 0.85,
}: BoundingBoxGizmoProps) {
  const instance = useStore((s) => s.instances.find((i) => i.id === instanceId))
  const frameWidth = useStore((s) => s.frameWidth)
  const frameHeight = useStore((s) => s.frameHeight)
  const updateInstance = useStore((s) => s.updateInstance)
  const { size: canvasSize } = useThree()
  const scaleDrag = useRef<{ startScale: number; startY: number; pointerId: number } | null>(
    null,
  )
  const moveDrag = useRef<{
    startX: number
    startY: number
    startClientX: number
    startClientY: number
    pointerId: number
  } | null>(null)
  const rotateYDrag = useRef<{
    startRotation: number
    startX: number
    startY: number
    startClientX: number
    pointerId: number
    scale: number
    characterZ: number
    characterRotationX: number
    characterRotationZ: number
  } | null>(null)

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

  const onMovePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    moveDrag.current = {
      startX: instance.x,
      startY: instance.y,
      startClientX: e.clientX,
      startClientY: e.clientY,
      pointerId: e.pointerId,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onMovePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!moveDrag.current || moveDrag.current.pointerId !== e.pointerId) return
    e.stopPropagation()
    const canvasW = Math.max(canvasSize.width, 1)
    const canvasH = Math.max(canvasSize.height, 1)
    const deltaX = (e.clientX - moveDrag.current.startClientX) / canvasW
    const deltaY = (e.clientY - moveDrag.current.startClientY) / canvasH
    const clamped = clampMannequinAnchor(
      {
        x: moveDrag.current.startX + deltaX,
        y: moveDrag.current.startY + deltaY,
      },
      { maxY: maxFeetAnchorY(instance.scale) },
    )
    patch({ x: clamped.x, y: clamped.y })
  }

  const endMoveDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!moveDrag.current || moveDrag.current.pointerId !== e.pointerId) return
    e.stopPropagation()
    moveDrag.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const onRotateYPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    rotateYDrag.current = {
      startRotation: instance.rotation,
      startX: instance.x,
      startY: instance.y,
      startClientX: e.clientX,
      pointerId: e.pointerId,
      scale: instance.scale,
      characterZ: instance.characterZ,
      characterRotationX: instance.characterRotationX,
      characterRotationZ: instance.characterRotationZ,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onRotateYPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!rotateYDrag.current || rotateYDrag.current.pointerId !== e.pointerId) return
    e.stopPropagation()
    const deltaDeg =
      (e.clientX - rotateYDrag.current.startClientX) * ROTATE_Y_DRAG_SENSITIVITY
    patch(
      rotateMannequinYawAroundModelCenter({
        x: rotateYDrag.current.startX,
        y: rotateYDrag.current.startY,
        scale: rotateYDrag.current.scale,
        rotation: rotateYDrag.current.startRotation,
        characterZ: rotateYDrag.current.characterZ,
        characterRotationX: rotateYDrag.current.characterRotationX,
        characterRotationZ: rotateYDrag.current.characterRotationZ,
        modelCenter: pivots.modelCenter,
        feetFromYawNeg: pivots.feetFromYawNeg,
        deltaRotationDeg: deltaDeg,
        frameWidth,
        frameHeight,
      }),
    )
  }

  const endRotateYDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!rotateYDrag.current || rotateYDrag.current.pointerId !== e.pointerId) return
    e.stopPropagation()
    rotateYDrag.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <group position={center}>
      <mesh
        raycast={() => null}
        ref={(node) => registerSelectionBounds(instanceId, node, pivots)}
        scale={[size.x, size.y, size.z]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color={wireframeColor}
          wireframe
          transparent
          opacity={wireframeOpacity}
          depthTest={false}
        />
      </mesh>

      {showControls && (
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
        scaleDrag={{
          onPointerDown: onScalePointerDown,
          onPointerMove: onScalePointerMove,
          endDrag: endScaleDrag,
        }}
        moveDrag={{
          onPointerDown: onMovePointerDown,
          onPointerMove: onMovePointerMove,
          endDrag: endMoveDrag,
        }}
        rotateYDrag={{
          onPointerDown: onRotateYPointerDown,
          onPointerMove: onRotateYPointerMove,
          endDrag: endRotateYDrag,
        }}
      />
      )}
    </group>
  )
}
