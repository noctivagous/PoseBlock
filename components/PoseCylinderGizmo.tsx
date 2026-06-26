'use client'

import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { PoseOp } from '../lib/poseCompose'
import { constraintForBone, type JointConstraint } from '../lib/poseJointConstraints'
import { canonicalBoneName, findSkeletonBone, updateSkeleton } from '../lib/poses'
import { useStore } from '../lib/store'

const RAD2DEG = 180 / Math.PI
const MIN_COMMIT_DEGREES = 0.1
const FACE_DRAG_TO_DEGREES = 0.22

type SegmentDef = {
  id: string
  bone: string
  end?: string
  radius: number
  fallbackLength: number
}

type SegmentRuntime = {
  def: SegmentDef
  bone: THREE.Bone
  endBone: THREE.Bone | null
}

type DragPart = 'facePosX' | 'faceNegX' | 'facePosY' | 'faceNegY' | 'facePosZ' | 'faceNegZ'

type DragState = {
  pointerId: number
  segmentId: string
  part: DragPart
  startX: number
  startY: number
  startBoneQuat: THREE.Quaternion
  constraint: JointConstraint
}

const SEGMENTS: SegmentDef[] = [
  { id: 'upperTorso', bone: 'Spine2', end: 'Neck', radius: 0.11, fallbackLength: 0.35 },
  { id: 'head', bone: 'Head', end: 'HeadTop_End', radius: 0.09, fallbackLength: 0.24 },
  { id: 'leftUpperArm', bone: 'LeftArm', end: 'LeftForeArm', radius: 0.065, fallbackLength: 0.32 },
  { id: 'leftLowerArm', bone: 'LeftForeArm', end: 'LeftHand', radius: 0.055, fallbackLength: 0.3 },
  { id: 'rightUpperArm', bone: 'RightArm', end: 'RightForeArm', radius: 0.065, fallbackLength: 0.32 },
  { id: 'rightLowerArm', bone: 'RightForeArm', end: 'RightHand', radius: 0.055, fallbackLength: 0.3 },
  { id: 'leftThigh', bone: 'LeftUpLeg', end: 'LeftLeg', radius: 0.075, fallbackLength: 0.4 },
  { id: 'leftLowerLeg', bone: 'LeftLeg', end: 'LeftFoot', radius: 0.065, fallbackLength: 0.36 },
  { id: 'leftFoot', bone: 'LeftFoot', end: 'LeftToeBase', radius: 0.05, fallbackLength: 0.22 },
  { id: 'rightThigh', bone: 'RightUpLeg', end: 'RightLeg', radius: 0.075, fallbackLength: 0.4 },
  { id: 'rightLowerLeg', bone: 'RightLeg', end: 'RightFoot', radius: 0.065, fallbackLength: 0.36 },
  { id: 'rightFoot', bone: 'RightFoot', end: 'RightToeBase', radius: 0.05, fallbackLength: 0.22 },
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function deltaToOps(delta: THREE.Quaternion, bone: string): PoseOp[] {
  const euler = new THREE.Euler().setFromQuaternion(delta, 'XYZ')
  const x = euler.x * RAD2DEG
  const y = euler.y * RAD2DEG
  const z = euler.z * RAD2DEG
  const ops: PoseOp[] = []
  if (Math.abs(x) >= MIN_COMMIT_DEGREES) ops.push({ type: 'rotateBone', bone, axis: 'x', degrees: x })
  if (Math.abs(y) >= MIN_COMMIT_DEGREES) ops.push({ type: 'rotateBone', bone, axis: 'y', degrees: y })
  if (Math.abs(z) >= MIN_COMMIT_DEGREES) ops.push({ type: 'rotateBone', bone, axis: 'z', degrees: z })
  return ops
}

export function PoseCylinderGizmo({
  skeleton,
  fitScale,
}: {
  skeleton: THREE.Skeleton
  fitScale: number
}) {
  const interactionMode = useStore((s) => s.interactionMode)
  const selectedPoseBone = useStore((s) => s.selectedPoseBone)
  const primaryId = useStore((s) => s.selectedIds[0] ?? null)
  const selectInstance = useStore((s) => s.selectInstance)
  const pushPoseOps = useStore((s) => s.pushPoseOps)
  const set = useStore((s) => s.set)

  const dragRef = useRef<DragState | null>(null)
  const constrainedDeltaRef = useRef(new THREE.Quaternion())

  const tempStart = useRef(new THREE.Vector3())
  const tempEnd = useRef(new THREE.Vector3())
  const tempDir = useRef(new THREE.Vector3())
  const tempQuat = useRef(new THREE.Quaternion())
  const tempUp = useRef(new THREE.Vector3(0, 1, 0))

  const segments = useMemo<SegmentRuntime[]>(() => {
    return SEGMENTS.map((def) => {
      const bone = findSkeletonBone(skeleton, def.bone)
      if (!bone) return null
      const endBone = def.end ? findSkeletonBone(skeleton, def.end) ?? null : null
      return { def, bone, endBone }
    }).filter((v): v is SegmentRuntime => Boolean(v))
  }, [skeleton])

  if (interactionMode !== 'pose') return null

  const localRadiusScale = fitScale > 0 ? 1 / fitScale : 1

  const beginDrag = (segment: SegmentRuntime, part: DragPart, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (primaryId) {
      if (e.nativeEvent.shiftKey) {
        selectInstance(primaryId, { shiftKey: true })
        if (!useStore.getState().selectedIds.includes(primaryId)) {
          set({ selectedPoseBone: null, selectedBodyPart: null })
          return
        }
      } else {
        selectInstance(primaryId)
      }
    }
    set({ selectedPoseBone: canonicalBoneName(segment.bone.name), selectedBodyPart: null })
    dragRef.current = {
      pointerId: e.pointerId,
      segmentId: segment.def.id,
      part,
      startX: e.clientX,
      startY: e.clientY,
      startBoneQuat: segment.bone.quaternion.clone(),
      constraint: constraintForBone(canonicalBoneName(segment.bone.name)),
    }
    constrainedDeltaRef.current.identity()
    ;(e.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId)
  }

  const selectSegment = (segment: SegmentRuntime, shiftKey: boolean) => {
    if (primaryId) {
      if (shiftKey) {
        selectInstance(primaryId, { shiftKey: true })
        if (!useStore.getState().selectedIds.includes(primaryId)) {
          set({ selectedPoseBone: null, selectedBodyPart: null })
          return
        }
      } else {
        selectInstance(primaryId)
      }
    }
    set({ selectedPoseBone: canonicalBoneName(segment.bone.name), selectedBodyPart: null })
  }

  const moveDrag = (segment: SegmentRuntime, e: ThreeEvent<PointerEvent>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId || drag.segmentId !== segment.def.id) return
    e.stopPropagation()

    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    const constraint = drag.constraint

    let rawX = 0
    let rawY = 0
    let rawZ = 0

    switch (drag.part) {
      case 'facePosX':
        rawX = -dy * FACE_DRAG_TO_DEGREES
        break
      case 'faceNegX':
        rawX = dy * FACE_DRAG_TO_DEGREES
        break
      case 'facePosY':
        rawY = dx * FACE_DRAG_TO_DEGREES
        break
      case 'faceNegY':
        rawY = -dx * FACE_DRAG_TO_DEGREES
        break
      case 'facePosZ':
        rawZ = dx * FACE_DRAG_TO_DEGREES
        break
      case 'faceNegZ':
        rawZ = -dx * FACE_DRAG_TO_DEGREES
        break
    }

    const x = constraint.enabled.x
      ? clamp(rawX, constraint.limitsDeg.x.min, constraint.limitsDeg.x.max)
      : 0
    const y = constraint.enabled.y
      ? clamp(rawY, constraint.limitsDeg.y.min, constraint.limitsDeg.y.max)
      : 0
    const z = constraint.enabled.z
      ? clamp(rawZ, constraint.limitsDeg.z.min, constraint.limitsDeg.z.max)
      : 0

    const delta = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(x / RAD2DEG, y / RAD2DEG, z / RAD2DEG, 'XYZ'),
    )
    constrainedDeltaRef.current.copy(delta)
    segment.bone.quaternion.copy(drag.startBoneQuat).multiply(delta).normalize()
    updateSkeleton(skeleton)
  }

  const endDrag = (segment: SegmentRuntime, e: ThreeEvent<PointerEvent>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId || drag.segmentId !== segment.def.id) return
    e.stopPropagation()
    dragRef.current = null
    pushPoseOps(deltaToOps(constrainedDeltaRef.current, canonicalBoneName(segment.bone.name)))
    ;(e.target as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(e.pointerId)
  }

  return (
    <group>
      {segments.map((segment) => {
        const isActive = selectedPoseBone === canonicalBoneName(segment.bone.name)
        return (
          <SegmentHandle
            key={segment.def.id}
            segment={segment}
            radius={segment.def.radius * localRadiusScale * 0.9}
            active={isActive}
            tempStart={tempStart.current}
            tempEnd={tempEnd.current}
            tempDir={tempDir.current}
            tempQuat={tempQuat.current}
            tempUp={tempUp.current}
            onSelect={selectSegment}
            onStartDrag={beginDrag}
            onMoveDrag={moveDrag}
            onEndDrag={endDrag}
          />
        )
      })}
    </group>
  )
}

function SegmentHandle({
  segment,
  radius,
  active,
  tempStart,
  tempEnd,
  tempDir,
  tempQuat,
  tempUp,
  onSelect,
  onStartDrag,
  onMoveDrag,
  onEndDrag,
}: {
  segment: SegmentRuntime
  radius: number
  active: boolean
  tempStart: THREE.Vector3
  tempEnd: THREE.Vector3
  tempDir: THREE.Vector3
  tempQuat: THREE.Quaternion
  tempUp: THREE.Vector3
  onSelect: (segment: SegmentRuntime, shiftKey: boolean) => void
  onStartDrag: (segment: SegmentRuntime, part: DragPart, e: ThreeEvent<PointerEvent>) => void
  onMoveDrag: (segment: SegmentRuntime, e: ThreeEvent<PointerEvent>) => void
  onEndDrag: (segment: SegmentRuntime, e: ThreeEvent<PointerEvent>) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const axisLen = radius * 2.15
  const axisThickness = Math.max(radius * 0.045, 0.003)
  const cubeHalf = radius * 1.2
  const faceDepth = Math.max(radius * 0.18, 0.008)
  const emphasis = active || hovered

  useFrame(() => {
    const group = groupRef.current
    if (!group) return

    segment.bone.getWorldPosition(tempStart)
    if (segment.endBone) {
      segment.endBone.getWorldPosition(tempEnd)
    } else {
      tempDir.set(0, 1, 0).applyQuaternion(segment.bone.getWorldQuaternion(tempQuat))
      tempEnd.copy(tempStart).addScaledVector(tempDir, segment.def.fallbackLength)
    }

    const parent = group.parent
    if (!parent) return

    parent.worldToLocal(tempStart)
    parent.worldToLocal(tempEnd)
    tempDir.copy(tempEnd).sub(tempStart)
    const length = Math.max(tempDir.length(), segment.def.fallbackLength * 0.6)
    tempDir.normalize()
    tempQuat.setFromUnitVectors(tempUp, tempDir)

    group.position.copy(tempStart).addScaledVector(tempDir, length * 0.5)
    group.quaternion.copy(tempQuat)
    group.scale.set(1, length, 1)
  })

  return (
    <group ref={groupRef}>
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onPointerDown={(e) => {
          e.stopPropagation()
          onSelect(segment, e.nativeEvent.shiftKey)
        }}
      >
        <boxGeometry args={[cubeHalf * 2, 1, cubeHalf * 2]} />
        <meshBasicMaterial
          color={emphasis ? '#38bdf8' : '#93c5fd'}
          transparent
          opacity={emphasis ? 0.4 : 0.2}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>

      <mesh
        position={[cubeHalf + faceDepth * 0.5, 0, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onPointerDown={(e) => onStartDrag(segment, 'facePosX', e)}
        onPointerMove={(e) => onMoveDrag(segment, e)}
        onPointerUp={(e) => onEndDrag(segment, e)}
        onPointerCancel={(e) => onEndDrag(segment, e)}
      >
        <boxGeometry args={[faceDepth, 0.86, cubeHalf * 1.7]} />
        <meshBasicMaterial
          color="#ff6b6b"
          transparent
          opacity={emphasis ? 0.68 : 0.35}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>

      <mesh
        position={[-(cubeHalf + faceDepth * 0.5), 0, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onPointerDown={(e) => onStartDrag(segment, 'faceNegX', e)}
        onPointerMove={(e) => onMoveDrag(segment, e)}
        onPointerUp={(e) => onEndDrag(segment, e)}
        onPointerCancel={(e) => onEndDrag(segment, e)}
      >
        <boxGeometry args={[faceDepth, 0.86, cubeHalf * 1.7]} />
        <meshBasicMaterial
          color="#ff6b6b"
          transparent
          opacity={emphasis ? 0.68 : 0.35}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>

      <mesh
        position={[0, 0.5 + faceDepth * 0.5, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onPointerDown={(e) => onStartDrag(segment, 'facePosY', e)}
        onPointerMove={(e) => onMoveDrag(segment, e)}
        onPointerUp={(e) => onEndDrag(segment, e)}
        onPointerCancel={(e) => onEndDrag(segment, e)}
      >
        <boxGeometry args={[cubeHalf * 1.7, faceDepth, cubeHalf * 1.7]} />
        <meshBasicMaterial color="#4ade80" transparent opacity={emphasis ? 0.68 : 0.35} depthTest={false} toneMapped={false} />
      </mesh>

      <mesh
        position={[0, -(0.5 + faceDepth * 0.5), 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onPointerDown={(e) => onStartDrag(segment, 'faceNegY', e)}
        onPointerMove={(e) => onMoveDrag(segment, e)}
        onPointerUp={(e) => onEndDrag(segment, e)}
        onPointerCancel={(e) => onEndDrag(segment, e)}
      >
        <boxGeometry args={[cubeHalf * 1.7, faceDepth, cubeHalf * 1.7]} />
        <meshBasicMaterial color="#4ade80" transparent opacity={emphasis ? 0.68 : 0.35} depthTest={false} toneMapped={false} />
      </mesh>

      <mesh
        position={[0, 0, cubeHalf + faceDepth * 0.5]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onPointerDown={(e) => onStartDrag(segment, 'facePosZ', e)}
        onPointerMove={(e) => onMoveDrag(segment, e)}
        onPointerUp={(e) => onEndDrag(segment, e)}
        onPointerCancel={(e) => onEndDrag(segment, e)}
      >
        <boxGeometry args={[cubeHalf * 1.7, 0.86, faceDepth]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={emphasis ? 0.68 : 0.35} depthTest={false} toneMapped={false} />
      </mesh>

      <mesh
        position={[0, 0, -(cubeHalf + faceDepth * 0.5)]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onPointerDown={(e) => onStartDrag(segment, 'faceNegZ', e)}
        onPointerMove={(e) => onMoveDrag(segment, e)}
        onPointerUp={(e) => onEndDrag(segment, e)}
        onPointerCancel={(e) => onEndDrag(segment, e)}
      >
        <boxGeometry args={[cubeHalf * 1.7, 0.86, faceDepth]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={emphasis ? 0.68 : 0.35} depthTest={false} toneMapped={false} />
      </mesh>

      {emphasis && (
        <>
          <mesh>
            <boxGeometry args={[axisLen * 2, axisThickness * 2, axisThickness * 2]} />
            <meshBasicMaterial color="#ff6b6b" transparent opacity={0.88} depthTest={false} />
          </mesh>
          <mesh>
            <boxGeometry args={[axisThickness * 2, 1.1, axisThickness * 2]} />
            <meshBasicMaterial color="#4ade80" transparent opacity={0.88} depthTest={false} />
          </mesh>
          <mesh>
            <boxGeometry args={[axisThickness * 2, axisThickness * 2, axisLen * 2]} />
            <meshBasicMaterial color="#60a5fa" transparent opacity={0.88} depthTest={false} />
          </mesh>
        </>
      )}
    </group>
  )
}
