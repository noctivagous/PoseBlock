'use client'

import { useGLTF, TransformControls } from '@react-three/drei'
import { Component, type ReactNode, useEffect, useMemo, useRef } from 'react'
import { SkeletonUtils } from 'three-stdlib'
import * as THREE from 'three'
import { POSES, lerpPose, CHARACTER_OPTIONS } from '@/lib/poses'
import { useStore } from '@/lib/store'

const MODEL_SCALE = 1.8
const MODEL_Y_OFFSET = -0.9

function ModelBoundingBox({ object }: { object: THREE.Object3D }) {
  const { size, center } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(object)
    const s = new THREE.Vector3()
    const c = new THREE.Vector3()
    box.getSize(s)
    box.getCenter(c)
    return { size: s, center: c }
  }, [object])

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
    </group>
  )
}

type CharacterModelProps = {
  modelUrl: string
  groupRef: React.RefObject<THREE.Group | null>
}

function CharacterModel({ modelUrl, groupRef }: CharacterModelProps) {
  const currentPose = useStore((s) => s.currentPose)
  const characterX = useStore((s) => s.characterX)
  const characterY = useStore((s) => s.characterY)
  const characterScale = useStore((s) => s.characterScale)
  const transformMode = useStore((s) => s.transformMode)
  const set = useStore((s) => s.set)
  const { scene } = useGLTF(modelUrl)
  const skeletonRef = useRef<THREE.Skeleton | null>(null)
  const isDragging = useRef(false)

  const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene])

  useEffect(() => {
    set({ characterError: null })
    let skeleton: THREE.Skeleton | null = null

    clonedScene.traverse((obj) => {
      if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
        skeleton = (obj as THREE.SkinnedMesh).skeleton
      }
    })

    if (!skeleton) {
      set({ characterError: 'No skeleton found — retarget may have failed' })
      skeletonRef.current = null
      return
    }

    skeletonRef.current = skeleton
  }, [clonedScene, set])

  useEffect(() => {
    if (!skeletonRef.current) return
    const pose = POSES[currentPose]
    if (pose) lerpPose(skeletonRef.current, pose, 1)
  }, [currentPose, clonedScene])

  useEffect(() => {
    const group = groupRef.current
    if (!group || isDragging.current) return
    group.position.set(characterX, characterY, 0.01)
    group.scale.setScalar(characterScale)
  }, [characterX, characterY, characterScale, groupRef])

  const syncStoreFromGroup = () => {
    const group = groupRef.current
    if (!group) return
    set({
      characterX: group.position.x,
      characterY: group.position.y,
      characterScale: group.scale.x,
    })
  }

  return (
    <>
      <group ref={groupRef} position={[characterX, characterY, 0.01]} scale={characterScale}>
        <primitive
          object={clonedScene}
          scale={MODEL_SCALE}
          position={[0, MODEL_Y_OFFSET, 0]}
        />
        <ModelBoundingBox object={clonedScene} />
      </group>

      <TransformControls
        object={groupRef as React.MutableRefObject<THREE.Object3D>}
        mode={transformMode}
        showZ={false}
        size={0.75}
        onMouseDown={() => {
          isDragging.current = true
        }}
        onMouseUp={() => {
          isDragging.current = false
          syncStoreFromGroup()
        }}
        onObjectChange={syncStoreFromGroup}
      />
    </>
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

export function CharacterManipulator() {
  const modelUrl = useStore((s) => s.modelUrl)
  const set = useStore((s) => s.set)
  const groupRef = useRef<THREE.Group>(null)

  return (
    <ModelErrorBoundary key={modelUrl} onError={(msg) => set({ characterError: msg })}>
      <CharacterModel key={modelUrl} modelUrl={modelUrl} groupRef={groupRef} />
    </ModelErrorBoundary>
  )
}

for (const option of CHARACTER_OPTIONS) {
  useGLTF.preload(option.url)
}
