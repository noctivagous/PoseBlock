'use client'

import { useFBX, useGLTF } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { SkeletonUtils } from 'three-stdlib'
import * as THREE from 'three'
import { isFbxModelUrl } from '../lib/characterModels'
import { displayScale } from '../lib/characterTransform'
import {
  anchorToWorldTransform,
  applyAnchorToGroup,
  syncAnchorFromGroup,
} from '../lib/framing/anchorAdapter'
import { alignSkeletonToMixamoBind } from '../lib/mixamoBind'
import { composePose } from '../lib/poseCompose'
import { getAllPosePresets } from '../lib/posePresets'
import { lerpPose, resetPose } from '../lib/poses'
import { useStore } from '../lib/store'
import { BoundingBoxGizmo } from './BoundingBoxGizmo'
import { PoseBodyPicker } from './PoseBodyPicker'
import { PoseJointGizmo } from './PoseJointGizmo'

const TARGET_MODEL_HEIGHT = 1.8
const DEG2RAD = Math.PI / 180

type CharacterModelProps = {
  modelUrl: string
  groupRef: React.RefObject<THREE.Group | null>
  instanceId: string
  isSelected: boolean
  isPrimary: boolean
}

type CharacterModelContentProps = {
  source: THREE.Object3D
  groupRef: React.RefObject<THREE.Group | null>
  alignMixamoBind: boolean
  instanceId: string
  isSelected: boolean
  isPrimary: boolean
}

function CharacterModelContent({
  source,
  groupRef,
  alignMixamoBind,
  instanceId,
  isSelected,
  isPrimary,
}: CharacterModelContentProps) {
  const instance = useStore((s) => s.instances.find((i) => i.id === instanceId))
  const posePresets = useStore((s) => s.posePresets)
  const frameWidth = useStore((s) => s.frameWidth)
  const frameHeight = useStore((s) => s.frameHeight)
  const interactionMode = useStore((s) => s.interactionMode)
  const updateInstance = useStore((s) => s.updateInstance)
  const selectInstance = useStore((s) => s.selectInstance)
  const set = useStore((s) => s.set)

  const skeletonRef = useRef<THREE.Skeleton | null>(null)
  const [skeleton, setSkeleton] = useState<THREE.Skeleton | null>(null)
  const isDragging = useRef(false)
  const dragPointerId = useRef<number | null>(null)
  const dragOffset = useRef(new THREE.Vector3())
  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])

  const clonedScene = useMemo(() => SkeletonUtils.clone(source), [source])
  const availablePoses = useMemo(() => getAllPosePresets(posePresets), [posePresets])
  const composedPose = useMemo(() => {
    if (!instance) return null
    const base = availablePoses[instance.basePoseId]
    if (!base) return null
    return composePose(base, instance.poseAdjustments)
  }, [availablePoses, instance])

  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const safeHeight = size.y > 0 ? size.y : 1
    const scale = TARGET_MODEL_HEIGHT / safeHeight
    const yOffset = -box.min.y * scale
    return { scale, yOffset, size, center }
  }, [clonedScene])

  useEffect(() => {
    set({ characterError: null })
    let found: THREE.Skeleton | null = null
    clonedScene.traverse((obj) => {
      if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
        found = (obj as THREE.SkinnedMesh).skeleton
      }
    })
    if (!found) {
      set({ characterError: 'No skeleton found — retarget may have failed' })
      skeletonRef.current = null
      setSkeleton(null)
      return
    }
    if (alignMixamoBind) alignSkeletonToMixamoBind(found)
    skeletonRef.current = found
    setSkeleton(found)
  }, [alignMixamoBind, clonedScene, set])

  useEffect(() => {
    if (!skeletonRef.current || !composedPose) return
    resetPose(skeletonRef.current)
    lerpPose(skeletonRef.current, composedPose, 1)
  }, [composedPose, clonedScene])

  useEffect(() => {
    const group = groupRef.current
    if (!group || !instance || isDragging.current) return
    applyAnchorToGroup(
      group,
      { x: instance.x, y: instance.y, scale: instance.scale, rotation: instance.rotation },
      instance.characterZ,
      instance.characterRotationX,
      frameWidth,
      frameHeight,
    )
  }, [instance, frameWidth, frameHeight, groupRef])

  if (!instance) return null

  const world = anchorToWorldTransform({
    anchor: {
      x: instance.x,
      y: instance.y,
      scale: instance.scale,
      rotation: instance.rotation,
    },
    characterZ: instance.characterZ,
    characterRotationX: instance.characterRotationX,
    frameWidth,
    frameHeight,
  })

  const syncStoreFromGroup = () => {
    const group = groupRef.current
    if (!group) return
    const synced = syncAnchorFromGroup(group, frameWidth, frameHeight)
    updateInstance(instanceId, {
      x: synced.x,
      y: synced.y,
      scale: synced.scale,
      rotation: synced.rotation,
      characterZ: synced.characterZ,
      characterRotationX: synced.characterRotationX,
      characterRotationY: synced.rotation,
    })
  }

  const updateDragPosition = (e: ThreeEvent<PointerEvent>) => {
    const group = groupRef.current
    if (!group) return
    dragPlane.set(new THREE.Vector3(0, 0, 1), -group.position.z)
    const hitPoint = new THREE.Vector3()
    if (!e.ray.intersectPlane(dragPlane, hitPoint)) return
    group.position.set(
      hitPoint.x - dragOffset.current.x,
      hitPoint.y - dragOffset.current.y,
      group.position.z,
    )
  }

  const onModelPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (interactionMode !== 'transform') return
    e.stopPropagation()
    selectInstance(instanceId, { shiftKey: e.nativeEvent.shiftKey })

    const group = groupRef.current
    if (!group) return

    isDragging.current = true
    dragPointerId.current = e.pointerId
    dragPlane.set(new THREE.Vector3(0, 0, 1), -group.position.z)
    const hitPoint = new THREE.Vector3()
    if (e.ray.intersectPlane(dragPlane, hitPoint)) {
      dragOffset.current.copy(hitPoint).sub(group.position)
    } else {
      dragOffset.current.set(0, 0, 0)
    }
    ;(e.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId)
  }

  const onModelPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current || dragPointerId.current !== e.pointerId) return
    e.stopPropagation()
    updateDragPosition(e)
  }

  const endModelDrag = (e: ThreeEvent<PointerEvent>) => {
    if (dragPointerId.current !== null && dragPointerId.current !== e.pointerId) return
    if (!isDragging.current) return
    e.stopPropagation()
    isDragging.current = false
    dragPointerId.current = null
    syncStoreFromGroup()
    ;(e.target as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(
      e.pointerId,
    )
  }

  return (
    <group
      ref={groupRef}
      position={[world.worldX, world.worldY, world.worldZ]}
      rotation={[
        world.characterRotationX * DEG2RAD,
        world.characterRotationY * DEG2RAD,
        0,
      ]}
      scale={displayScale(world.characterScale, world.worldZ)}
      onPointerDown={onModelPointerDown}
      onPointerMove={onModelPointerMove}
      onPointerUp={endModelDrag}
      onPointerCancel={endModelDrag}
    >
      <group scale={fit.scale} position={[0, fit.yOffset, 0]}>
        <primitive object={clonedScene} />
        {isSelected && (
          <mesh scale={[fit.size.x, fit.size.y, fit.size.z]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              color={isPrimary ? '#fbbf24' : '#38bdf8'}
              wireframe
              transparent
              opacity={0.35}
              depthTest={false}
            />
          </mesh>
        )}
        {isPrimary && interactionMode === 'transform' && (
          <BoundingBoxGizmo instanceId={instanceId} size={fit.size} center={fit.center} />
        )}
        {isPrimary && skeleton && (
          <>
            <PoseBodyPicker skeleton={skeleton} fitScale={fit.scale} />
            <PoseJointGizmo skeleton={skeleton} />
          </>
        )}
      </group>
    </group>
  )
}

function GlbCharacterModel(props: CharacterModelProps) {
  const { scene } = useGLTF(props.modelUrl)
  return (
    <CharacterModelContent
      source={scene}
      groupRef={props.groupRef}
      alignMixamoBind={false}
      instanceId={props.instanceId}
      isSelected={props.isSelected}
      isPrimary={props.isPrimary}
    />
  )
}

function FbxCharacterModel(props: CharacterModelProps) {
  const fbx = useFBX(props.modelUrl)
  return (
    <CharacterModelContent
      source={fbx}
      groupRef={props.groupRef}
      alignMixamoBind
      instanceId={props.instanceId}
      isSelected={props.isSelected}
      isPrimary={props.isPrimary}
    />
  )
}

function CharacterModel(props: CharacterModelProps) {
  if (isFbxModelUrl(props.modelUrl)) {
    return <FbxCharacterModel {...props} />
  }
  return <GlbCharacterModel {...props} />
}

type ErrorBoundaryProps = {
  children: ReactNode
  onError: (message: string) => void
}

class ModelErrorBoundary extends Component<ErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError(error.message || 'Model failed to load')
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

function CharacterPreloader() {
  const characterModels = useStore((s) => s.characterModels)
  useEffect(() => {
    for (const model of characterModels) {
      if (isFbxModelUrl(model.url)) {
        useFBX.preload(model.url)
      } else {
        useGLTF.preload(model.url)
      }
    }
  }, [characterModels])
  return null
}

type CharacterManipulatorProps = {
  instanceId: string
  isSelected: boolean
  isPrimary: boolean
}

export function CharacterManipulator({
  instanceId,
  isSelected,
  isPrimary,
}: CharacterManipulatorProps) {
  const instance = useStore((s) => s.instances.find((i) => i.id === instanceId))
  const set = useStore((s) => s.set)
  const groupRef = useRef<THREE.Group>(null)

  if (!instance?.modelUrl) return null

  return (
    <ModelErrorBoundary
      key={instance.modelUrl + instanceId}
      onError={(msg) => set({ characterError: msg })}
    >
      <CharacterModel
        modelUrl={instance.modelUrl}
        groupRef={groupRef}
        instanceId={instanceId}
        isSelected={isSelected}
        isPrimary={isPrimary}
      />
    </ModelErrorBoundary>
  )
}

export function CharacterManipulatorLayer() {
  const instances = useStore((s) => s.instances)
  const selectedIds = useStore((s) => s.selectedIds)
  const primaryId = selectedIds[0] ?? null

  return (
    <>
      <CharacterPreloader />
      {instances.map((inst) => (
        <CharacterManipulator
          key={inst.id}
          instanceId={inst.id}
          isSelected={selectedIds.includes(inst.id)}
          isPrimary={inst.id === primaryId}
        />
      ))}
    </>
  )
}
