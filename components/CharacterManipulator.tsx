'use client'

import { useGLTF } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { SkeletonUtils } from 'three-stdlib'
import * as THREE from 'three'
import { composePose } from '@/lib/poseCompose'
import { displayScale, baseScaleFromDisplay } from '@/lib/characterTransform'
import { getAllPosePresets } from '@/lib/posePresets'
import { lerpPose, resetPose } from '@/lib/poses'
import { useStore } from '@/lib/store'
import { BoundingBoxGizmo } from './BoundingBoxGizmo'
import { PoseBodyPicker } from './PoseBodyPicker'
import { PosePartControls } from './PosePartControls'

const TARGET_MODEL_HEIGHT = 1.8
const DEG2RAD = Math.PI / 180

type CharacterModelProps = {
  modelUrl: string
  groupRef: React.RefObject<THREE.Group | null>
}

function CharacterModel({ modelUrl, groupRef }: CharacterModelProps) {
  const basePoseId = useStore((s) => s.basePoseId)
  const poseAdjustments = useStore((s) => s.poseAdjustments)
  const posePresets = useStore((s) => s.posePresets)
  const characterX = useStore((s) => s.characterX)
  const characterY = useStore((s) => s.characterY)
  const characterZ = useStore((s) => s.characterZ)
  const characterRotationY = useStore((s) => s.characterRotationY)
  const characterScale = useStore((s) => s.characterScale)
  const interactionMode = useStore((s) => s.interactionMode)
  const set = useStore((s) => s.set)
  const { scene } = useGLTF(modelUrl)
  const skeletonRef = useRef<THREE.Skeleton | null>(null)
  const [skeleton, setSkeleton] = useState<THREE.Skeleton | null>(null)
  const isDragging = useRef(false)
  const dragPointerId = useRef<number | null>(null)
  const dragOffset = useRef(new THREE.Vector3())
  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])

  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const availablePoses = useMemo(() => getAllPosePresets(posePresets), [posePresets])
  const composedPose = useMemo(() => {
    const base = availablePoses[basePoseId]
    if (!base) return null
    return composePose(base, poseAdjustments)
  }, [availablePoses, basePoseId, poseAdjustments])
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

    skeletonRef.current = found
    setSkeleton(found)
  }, [clonedScene, set])

  useEffect(() => {
    if (!skeletonRef.current || !composedPose) return
    resetPose(skeletonRef.current)
    lerpPose(skeletonRef.current, composedPose, 1)
  }, [composedPose, clonedScene])

  useEffect(() => {
    const group = groupRef.current
    if (!group || isDragging.current) return
    group.position.set(characterX, characterY, characterZ)
    group.rotation.set(0, characterRotationY * DEG2RAD, 0)
    group.scale.setScalar(displayScale(characterScale, characterZ))
  }, [characterScale, characterRotationY, characterX, characterY, characterZ, groupRef])

  const syncStoreFromGroup = () => {
    const group = groupRef.current
    if (!group) return
    set({
      characterX: group.position.x,
      characterY: group.position.y,
      characterZ: group.position.z,
      characterRotationY: group.rotation.y / DEG2RAD,
      characterScale: baseScaleFromDisplay(group.scale.x, group.position.z),
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
      group.position.z
    )
  }

  const onModelPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (interactionMode !== 'transform') return
    const group = groupRef.current
    if (!group) return

    e.stopPropagation()
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
      e.pointerId
    )
  }

  return (
    <group
      ref={groupRef}
      position={[characterX, characterY, characterZ]}
      rotation={[0, characterRotationY * DEG2RAD, 0]}
      scale={displayScale(characterScale, characterZ)}
      onPointerDown={onModelPointerDown}
      onPointerMove={onModelPointerMove}
      onPointerUp={endModelDrag}
      onPointerCancel={endModelDrag}
    >
      <group scale={fit.scale} position={[0, fit.yOffset, 0]}>
        <primitive object={clonedScene} />
        {interactionMode === 'transform' && (
          <BoundingBoxGizmo size={fit.size} center={fit.center} />
        )}
        {skeleton && (
          <>
            <PoseBodyPicker skeleton={skeleton} fitScale={fit.scale} />
            <PosePartControls skeleton={skeleton} />
          </>
        )}
      </group>
    </group>
  )
}

type ErrorBoundaryProps = {
  children: ReactNode
  onError: (message: string) => void
}

type ErrorBoundaryState = {
  hasError: boolean
}

class ModelErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
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
      useGLTF.preload(model.url)
    }
  }, [characterModels])

  return null
}

export function CharacterManipulator() {
  const modelUrl = useStore((s) => s.modelUrl)
  const set = useStore((s) => s.set)
  const groupRef = useRef<THREE.Group>(null)

  if (!modelUrl) return <CharacterPreloader />

  return (
    <>
      <CharacterPreloader />
      <ModelErrorBoundary key={modelUrl} onError={(msg) => set({ characterError: msg })}>
        <CharacterModel key={modelUrl} modelUrl={modelUrl} groupRef={groupRef} />
      </ModelErrorBoundary>
    </>
  )
}
