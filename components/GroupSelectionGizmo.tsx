'use client'

import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { applyMannequinRollZKeepingFeetWorld, dollyAnchor, rotateMannequinYawAroundModelCenter } from '../lib/characterTransform'
import { clampMannequinScale } from '../lib/framing'
import { getSelectionBoundsMeta } from '../lib/selectionBoundsRegistry'
import { useStore } from '../lib/store'
import { TransformGizmoControls } from './BoundingBoxGizmo'

const U = 0.5
const BOX_EDGES: [THREE.Vector3Tuple, THREE.Vector3Tuple][] = [
  [
    [-U, -U, -U],
    [U, -U, -U],
  ],
  [
    [U, -U, -U],
    [U, -U, U],
  ],
  [
    [U, -U, U],
    [-U, -U, U],
  ],
  [
    [-U, -U, U],
    [-U, -U, -U],
  ],
  [
    [-U, U, -U],
    [U, U, -U],
  ],
  [
    [U, U, -U],
    [U, U, U],
  ],
  [
    [U, U, U],
    [-U, U, U],
  ],
  [
    [-U, U, U],
    [-U, U, -U],
  ],
  [
    [-U, -U, -U],
    [-U, U, -U],
  ],
  [
    [U, -U, -U],
    [U, U, -U],
  ],
  [
    [U, -U, U],
    [U, U, U],
  ],
  [
    [-U, -U, U],
    [-U, U, U],
  ],
]

const unionBox = new THREE.Box3()
const tempBox = new THREE.Box3()
const unionCenter = new THREE.Vector3()
const unionSize = new THREE.Vector3()

function PurpleGroupBox({ lineWidth = 3 }: { lineWidth?: number }) {
  return (
    <>
      {BOX_EDGES.map((points, i) => (
        <Line key={i} points={points} color="#a855f7" lineWidth={lineWidth} />
      ))}
    </>
  )
}

export function GroupSelectionGizmo() {
  const selectedIds = useStore((s) => s.selectedIds)
  const interactionMode = useStore((s) => s.interactionMode)
  const mode = useStore((s) => s.mode)
  const frameWidth = useStore((s) => s.frameWidth)
  const frameHeight = useStore((s) => s.frameHeight)
  const updateSelectedInstances = useStore((s) => s.updateSelectedInstances)
  const groupRef = useRef<THREE.Group>(null)
  const boxScaleRef = useRef<THREE.Group>(null)
  const gizmoSizeRef = useRef(new THREE.Vector3(1, 1, 1))

  const scaleDrag = useRef<{ startScales: Map<string, number>; startY: number; pointerId: number } | null>(
    null,
  )

  const showGizmo =
    selectedIds.length > 1 && mode !== 'controlRig' && interactionMode === 'transform'

  useFrame(() => {
    const group = groupRef.current
    const boxScale = boxScaleRef.current
    if (!group || !boxScale || !showGizmo) return

    let hasAny = false
    unionBox.makeEmpty()
    for (const id of selectedIds) {
      const obj = getSelectionBoundsMeta(id)?.object
      if (!obj) continue
      tempBox.setFromObject(obj)
      if (tempBox.isEmpty()) continue
      if (hasAny) unionBox.union(tempBox)
      else {
        unionBox.copy(tempBox)
        hasAny = true
      }
    }

    if (!hasAny) {
      group.visible = false
      return
    }

    group.visible = true
    unionBox.getCenter(unionCenter)
    unionBox.getSize(unionSize)
    group.position.copy(unionCenter)
    gizmoSizeRef.current.set(
      Math.max(unionSize.x, 0.01),
      Math.max(unionSize.y, 0.01),
      Math.max(unionSize.z, 0.01),
    )
    boxScale.scale.set(
      gizmoSizeRef.current.x,
      gizmoSizeRef.current.y,
      gizmoSizeRef.current.z,
    )
  })

  if (!showGizmo) return null

  const onScalePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    const instances = useStore.getState().instances
    const startScales = new Map<string, number>()
    for (const id of selectedIds) {
      const inst = instances.find((i) => i.id === id)
      if (inst) startScales.set(id, inst.scale)
    }
    scaleDrag.current = { startScales, startY: e.clientY, pointerId: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onScalePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!scaleDrag.current || scaleDrag.current.pointerId !== e.pointerId) return
    e.stopPropagation()
    const delta = (scaleDrag.current.startY - e.clientY) * 0.008
    const startScales = scaleDrag.current.startScales
    updateSelectedInstances((inst) => {
      const start = startScales.get(inst.id)
      if (start === undefined) return {}
      return { scale: clampMannequinScale(start + delta) }
    })
  }

  const endScaleDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!scaleDrag.current || scaleDrag.current.pointerId !== e.pointerId) return
    e.stopPropagation()
    scaleDrag.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const rotateSelectedYaw = (deltaRotationDeg: number) => {
    updateSelectedInstances((inst) => {
      const meta = getSelectionBoundsMeta(inst.id)
      if (!meta) return { rotation: inst.rotation + deltaRotationDeg }
      return rotateMannequinYawAroundModelCenter({
        x: inst.x,
        y: inst.y,
        scale: inst.scale,
        rotation: inst.rotation,
        characterZ: inst.characterZ,
        characterRotationX: inst.characterRotationX,
        characterRotationZ: inst.characterRotationZ,
        modelCenter: meta.pivots.modelCenter,
        rollPivot: meta.pivots.rollPivot,
        deltaRotationDeg,
        frameWidth,
        frameHeight,
      })
    })
  }

  return (
    <group ref={groupRef} visible={false}>
      <group ref={boxScaleRef}>
        <PurpleGroupBox lineWidth={3} />
      </group>
      <TransformGizmoControls
        sizeRef={gizmoSizeRef}
        rotateLeft={() => rotateSelectedYaw(-15)}
        rotateRight={() => rotateSelectedYaw(15)}
        dollyIn={() =>
          updateSelectedInstances((inst) =>
            dollyAnchor({ scale: inst.scale }, inst.characterZ, 1),
          )
        }
        dollyOut={() =>
          updateSelectedInstances((inst) =>
            dollyAnchor({ scale: inst.scale }, inst.characterZ, -1),
          )
        }
        pitchUp={() =>
          updateSelectedInstances((inst) => ({
            characterRotationX: Math.min(160, inst.characterRotationX + 12),
          }))
        }
        pitchDown={() =>
          updateSelectedInstances((inst) => ({
            characterRotationX: Math.max(-160, inst.characterRotationX - 12),
          }))
        }
        tiltLeft={() => {
          const TILT_STEP = 12
          const MAX_TILT = 45
          updateSelectedInstances((inst) => {
            const meta = getSelectionBoundsMeta(inst.id)
            const next = Math.min(MAX_TILT, inst.characterRotationZ + TILT_STEP)
            const delta = next - inst.characterRotationZ
            if (delta === 0) return {}
            if (!meta) return { characterRotationZ: next }
            return applyMannequinRollZKeepingFeetWorld({
              x: inst.x,
              y: inst.y,
              scale: inst.scale,
              rotation: inst.rotation,
              characterZ: inst.characterZ,
              characterRotationX: inst.characterRotationX,
              characterRotationZ: inst.characterRotationZ,
              modelCenter: meta.pivots.modelCenter,
              rollPivot: meta.pivots.rollPivot,
              deltaRotationDeg: delta,
              frameWidth,
              frameHeight,
            })
          })
        }}
        tiltRight={() => {
          const TILT_STEP = 12
          const MAX_TILT = 45
          updateSelectedInstances((inst) => {
            const meta = getSelectionBoundsMeta(inst.id)
            const next = Math.max(-MAX_TILT, inst.characterRotationZ - TILT_STEP)
            const delta = next - inst.characterRotationZ
            if (delta === 0) return {}
            if (!meta) return { characterRotationZ: next }
            return applyMannequinRollZKeepingFeetWorld({
              x: inst.x,
              y: inst.y,
              scale: inst.scale,
              rotation: inst.rotation,
              characterZ: inst.characterZ,
              characterRotationX: inst.characterRotationX,
              characterRotationZ: inst.characterRotationZ,
              modelCenter: meta.pivots.modelCenter,
              rollPivot: meta.pivots.rollPivot,
              deltaRotationDeg: delta,
              frameWidth,
              frameHeight,
            })
          })
        }}
        onScalePointerDown={onScalePointerDown}
        onScalePointerMove={onScalePointerMove}
        endScaleDrag={endScaleDrag}
      />
    </group>
  )
}
