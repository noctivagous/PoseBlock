'use client'

import { PivotControls, useFBX, useGLTF } from '@react-three/drei'
import { type ThreeEvent, useFrame } from '@react-three/fiber'
import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { SkeletonUtils } from 'three-stdlib'
import * as THREE from 'three'
import { CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver.js'
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
import type { ControlRig, PinKey, Pins } from '../lib/instances'
import { findSkeletonBone, lerpPose, MIXAMO_BONES, resetPose } from '../lib/poses'
import { registerSelectionBounds } from '../lib/selectionBoundsRegistry'
import { useStore } from '../lib/store'
import { findPoseModelUrl, useAnimationPoseSample } from '../lib/useAnimationPoseSample'
import { BoundingBoxGizmo } from './BoundingBoxGizmo'
import { GroupSelectionGizmo } from './GroupSelectionGizmo'
import { PoseBodyPicker } from './PoseBodyPicker'
import { PoseCylinderGizmo } from './PoseCylinderGizmo'
import { PoseJointGizmo } from './PoseJointGizmo'
import { PoseJointSphereGizmo } from './PoseJointSphereGizmo'

const TARGET_MODEL_HEIGHT = 1.8
const DEG2RAD = Math.PI / 180
const tempVec = new THREE.Vector3()
const tempQuat = new THREE.Quaternion()

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
  const poseModels = useStore((s) => s.poseModels)
  const frameWidth = useStore((s) => s.frameWidth)
  const frameHeight = useStore((s) => s.frameHeight)
  const interactionMode = useStore((s) => s.interactionMode)
  const poseGizmoMode = useStore((s) => s.poseGizmoMode)
  const mode = useStore((s) => s.mode)
  const updateInstance = useStore((s) => s.updateInstance)
  const setInstanceControlRig = useStore((s) => s.setInstanceControlRig)
  const setInstancePin = useStore((s) => s.setInstancePin)
  const setInstancePinnedWorldPos = useStore((s) => s.setInstancePinnedWorldPos)
  const selectInstance = useStore((s) => s.selectInstance)
  const selectedCount = useStore((s) => s.selectedIds.length)
  const set = useStore((s) => s.set)

  const skeletonRef = useRef<THREE.Skeleton | null>(null)
  const solverRef = useRef<CCDIKSolver | null>(null)
  const fkPoseRef = useRef<Record<string, number[]>>({})
  const rigPoseSigRef = useRef<string>('')
  const [skeleton, setSkeleton] = useState<THREE.Skeleton | null>(null)
  const isDragging = useRef(false)
  const dragPointerId = useRef<number | null>(null)
  const dragOffset = useRef(new THREE.Vector3())
  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])

  const clonedScene = useMemo(() => SkeletonUtils.clone(source), [source])
  const availablePoses = useMemo(() => getAllPosePresets(posePresets), [posePresets])

  const animationModelUrl = useMemo(() => {
    if (!instance || instance.poseSourceMode !== 'animation') return null
    return findPoseModelUrl(poseModels, instance.animationPoseModelId)
  }, [instance, poseModels])

  const useAnimation =
    instance?.poseSourceMode === 'animation' && Boolean(animationModelUrl)

  const { pose: animationPose } = useAnimationPoseSample(
    animationModelUrl,
    instance?.animationClip ?? null,
    instance?.animationFrame ?? 0,
    useAnimation,
  )

  const composedPose = useMemo(() => {
    if (!instance) return null
    let base =
      instance.poseSourceMode === 'animation'
        ? animationPose
        : availablePoses[instance.basePoseId]
    if (!base || Object.keys(base).length === 0) base = availablePoses.t_pose
    if (!base) return null
    return composePose(base, instance.poseAdjustments)
  }, [availablePoses, instance, animationPose])

  const poseRigSignature = useMemo(() => {
    if (!instance) return ''
    if (instance.poseSourceMode === 'animation') {
      return `anim:${instance.animationPoseModelId}:${instance.animationClip}:${instance.animationFrame}:${JSON.stringify(instance.poseAdjustments)}`
    }
    return `${instance.basePoseId}:${JSON.stringify(instance.poseAdjustments)}`
  }, [instance])

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
    const skinned = clonedScene.getObjectByProperty('isSkinnedMesh', true) as
      | THREE.SkinnedMesh
      | undefined
    const found = skinned?.skeleton
    if (!found) {
      set({ characterError: 'No skeleton found — retarget may have failed' })
      skeletonRef.current = null
      setSkeleton(null)
      return
    }
    const skeletonFound = found
    if (alignMixamoBind) alignSkeletonToMixamoBind(skeletonFound)
    const getBoneIndex = (name: string) => {
      const bone = findSkeletonBone(skeletonFound, name)
      return bone ? skeletonFound.bones.indexOf(bone) : -1
    }
    const chains = [
      {
        target: getBoneIndex('LeftHand'),
        effector: getBoneIndex('LeftHand'),
        links: [
          {
            index: getBoneIndex('LeftForeArm'),
            rotationMin: new THREE.Vector3(0, -0.2, -0.2),
            rotationMax: new THREE.Vector3(2.4, 0.2, 0.2),
          },
          {
            index: getBoneIndex('LeftArm'),
            rotationMin: new THREE.Vector3(-1.5, -1, -1),
            rotationMax: new THREE.Vector3(1.5, 1, 1),
          },
          { index: getBoneIndex('LeftShoulder') },
        ].filter((l) => l.index >= 0),
      },
      {
        target: getBoneIndex('RightHand'),
        effector: getBoneIndex('RightHand'),
        links: [
          {
            index: getBoneIndex('RightForeArm'),
            rotationMin: new THREE.Vector3(0, -0.2, -0.2),
            rotationMax: new THREE.Vector3(2.4, 0.2, 0.2),
          },
          {
            index: getBoneIndex('RightArm'),
            rotationMin: new THREE.Vector3(-1.5, -1, -1),
            rotationMax: new THREE.Vector3(1.5, 1, 1),
          },
          { index: getBoneIndex('RightShoulder') },
        ].filter((l) => l.index >= 0),
      },
      {
        target: getBoneIndex('LeftFoot'),
        effector: getBoneIndex('LeftFoot'),
        links: [
          {
            index: getBoneIndex('LeftLeg'),
            rotationMin: new THREE.Vector3(0, -0.1, -0.1),
            rotationMax: new THREE.Vector3(2.6, 0.1, 0.1),
          },
          {
            index: getBoneIndex('LeftUpLeg'),
            rotationMin: new THREE.Vector3(-1.8, -0.5, -0.5),
            rotationMax: new THREE.Vector3(0.5, 0.5, 0.5),
          },
        ].filter((l) => l.index >= 0),
      },
      {
        target: getBoneIndex('RightFoot'),
        effector: getBoneIndex('RightFoot'),
        links: [
          {
            index: getBoneIndex('RightLeg'),
            rotationMin: new THREE.Vector3(0, -0.1, -0.1),
            rotationMax: new THREE.Vector3(2.6, 0.1, 0.1),
          },
          {
            index: getBoneIndex('RightUpLeg'),
            rotationMin: new THREE.Vector3(-1.8, -0.5, -0.5),
            rotationMax: new THREE.Vector3(0.5, 0.5, 0.5),
          },
        ].filter((l) => l.index >= 0),
      },
      {
        target: getBoneIndex('Head'),
        effector: getBoneIndex('Head'),
        links: [
          {
            index: getBoneIndex('Neck'),
            rotationMin: new THREE.Vector3(-0.5, -0.8, -0.5),
            rotationMax: new THREE.Vector3(0.5, 0.8, 0.5),
          },
        ].filter((l) => l.index >= 0),
      },
      {
        target: getBoneIndex('Spine2'),
        effector: getBoneIndex('Spine2'),
        links: [
          {
            index: getBoneIndex('Spine1'),
            rotationMin: new THREE.Vector3(-0.3, -0.3, -0.3),
            rotationMax: new THREE.Vector3(0.3, 0.3, 0.3),
          },
          { index: getBoneIndex('Spine') },
        ].filter((l) => l.index >= 0),
      },
    ].filter((c) => c.target >= 0)
    const solverSkinned = clonedScene.getObjectByProperty('isSkinnedMesh', true) as
      | THREE.SkinnedMesh
      | undefined
    solverRef.current = solverSkinned ? new CCDIKSolver(solverSkinned, chains as never) : null
    skeletonRef.current = skeletonFound
    setSkeleton(skeletonFound)
  }, [alignMixamoBind, clonedScene, set])

  useEffect(() => {
    if (!skeletonRef.current || !composedPose) return
    if (mode === 'controlRig' && instance?.controlRig.initialized) return
    resetPose(skeletonRef.current)
    lerpPose(skeletonRef.current, composedPose, 1)
  }, [composedPose, clonedScene, mode, instance?.controlRig.initialized])

  useEffect(() => {
    if (mode !== 'controlRig' || !skeletonRef.current || !composedPose || !instance) return
    if (instance.controlRig.initialized && rigPoseSigRef.current === poseRigSignature) return

    resetPose(skeletonRef.current)
    lerpPose(skeletonRef.current, composedPose, 1)

    const getWorldPos = (boneName: string): [number, number, number] => {
      const bone = findSkeletonBone(skeletonRef.current as THREE.Skeleton, boneName)
      if (!bone) return [0, 0, 0]
      bone.getWorldPosition(tempVec)
      return tempVec.toArray() as [number, number, number]
    }

    setInstanceControlRig(instanceId, {
      initialized: true,
      head: getWorldPos('Head'),
      chest: getWorldPos('Spine2'),
      hips: getWorldPos('Hips'),
      leftHand: getWorldPos('LeftHand'),
      rightHand: getWorldPos('RightHand'),
      leftFoot: getWorldPos('LeftFoot'),
      rightFoot: getWorldPos('RightFoot'),
    })
    rigPoseSigRef.current = poseRigSignature
  }, [composedPose, instance, instanceId, mode, poseRigSignature, setInstanceControlRig])

  useFrame(() => {
    if (mode !== 'controlRig' || !skeletonRef.current || !solverRef.current || !instance) return
    const activeSkeleton = skeletonRef.current

    const fkPose: Record<string, number[]> = {}
    MIXAMO_BONES.forEach((name) => {
      const bone = findSkeletonBone(activeSkeleton, name)
      if (bone) fkPose[name] = bone.quaternion.toArray() as number[]
    })
    fkPoseRef.current = fkPose

    const setTarget = (
      boneName: string,
      pos: [number, number, number],
      isPinned: boolean,
      pinnedPos: [number, number, number],
    ) => {
      const bone = findSkeletonBone(activeSkeleton, boneName)
      if (!bone) return
      const worldPos = new THREE.Vector3().fromArray(isPinned ? pinnedPos : pos)
      if (bone.parent) {
        bone.parent.worldToLocal(worldPos)
      }
      bone.position.copy(worldPos)
    }

    setTarget('LeftHand', instance.controlRig.leftHand, instance.pins.leftHand, instance.pinnedWorldPos.leftHand)
    setTarget('RightHand', instance.controlRig.rightHand, instance.pins.rightHand, instance.pinnedWorldPos.rightHand)
    setTarget('LeftFoot', instance.controlRig.leftFoot, instance.pins.leftFoot, instance.pinnedWorldPos.leftFoot)
    setTarget('RightFoot', instance.controlRig.rightFoot, instance.pins.rightFoot, instance.pinnedWorldPos.rightFoot)
    setTarget('Head', instance.controlRig.head, false, [0, 0, 0])
    setTarget('Spine2', instance.controlRig.chest, false, [0, 0, 0])
    setTarget('Hips', instance.controlRig.hips, false, [0, 0, 0])

    solverRef.current.update()

    const blendLimb = (boneNames: string[], blend: number) => {
      if (blend >= 0.999) return
      boneNames.forEach((name) => {
        const bone = findSkeletonBone(activeSkeleton, name)
        if (!bone || !fkPoseRef.current[name]) return
        const fkQ = tempQuat.fromArray(fkPoseRef.current[name])
        bone.quaternion.slerpQuaternions(fkQ, bone.quaternion, blend)
      })
    }

    blendLimb(['LeftArm', 'LeftForeArm', 'LeftHand'], instance.ikBlend.leftArm)
    blendLimb(['RightArm', 'RightForeArm', 'RightHand'], instance.ikBlend.rightArm)
    blendLimb(['LeftUpLeg', 'LeftLeg', 'LeftFoot'], instance.ikBlend.leftLeg)
    blendLimb(['RightUpLeg', 'RightLeg', 'RightFoot'], instance.ikBlend.rightLeg)

    activeSkeleton.update()
  })

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
    if (mode === 'controlRig') return
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
    <>
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
            <mesh
              ref={(node) => registerSelectionBounds(instanceId, node)}
              position={[fit.center.x, fit.center.y, fit.center.z]}
              scale={[fit.size.x, fit.size.y, fit.size.z]}
            >
              <boxGeometry args={[1, 1, 1]} />
              <meshBasicMaterial
                color={selectedCount === 1 && isPrimary ? '#fbbf24' : '#38bdf8'}
                wireframe
                transparent
                opacity={selectedCount === 1 ? 0.35 : 0.25}
                depthTest={false}
              />
            </mesh>
          )}
          {isSelected &&
            selectedCount === 1 &&
            mode !== 'controlRig' &&
            interactionMode === 'transform' && (
            <BoundingBoxGizmo instanceId={instanceId} size={fit.size} center={fit.center} />
          )}
          {isPrimary && mode !== 'controlRig' && skeleton && poseGizmoMode === 'legacy' && (
            <>
              <PoseBodyPicker skeleton={skeleton} fitScale={fit.scale} />
              <PoseJointGizmo skeleton={skeleton} />
            </>
          )}
          {isPrimary && mode !== 'controlRig' && skeleton && poseGizmoMode === 'joint' && (
            <PoseJointSphereGizmo skeleton={skeleton} fitScale={fit.scale} />
          )}
          {isPrimary && mode !== 'controlRig' && skeleton && poseGizmoMode === 'cylinder' && (
            <PoseCylinderGizmo skeleton={skeleton} fitScale={fit.scale} />
          )}
        </group>
      </group>
      {isPrimary && mode === 'controlRig' && (
        <ControlRigHandles
          instanceId={instanceId}
          controlRig={instance.controlRig}
          pins={instance.pins}
          setControlRig={setInstanceControlRig}
          setPin={setInstancePin}
          setPinnedWorldPos={setInstancePinnedWorldPos}
        />
      )}
    </>
  )
}

type ControlRigHandlesProps = {
  instanceId: string
  controlRig: ControlRig
  pins: Pins
  setControlRig: (id: string, update: Partial<ControlRig>) => void
  setPin: (id: string, key: PinKey, value: boolean) => void
  setPinnedWorldPos: (
    id: string,
    key: PinKey,
    pos: [number, number, number],
  ) => void
}

function ControlRigHandles({
  instanceId,
  controlRig,
  pins,
  setControlRig,
  setPin,
  setPinnedWorldPos,
}: ControlRigHandlesProps) {
  const handles = [
    { key: 'head' as const, color: '#ffaa00', size: 0.08 },
    { key: 'chest' as const, color: '#aa00ff', size: 0.08 },
    { key: 'hips' as const, color: '#ff0066', size: 0.1 },
    { key: 'leftHand' as const, color: pins.leftHand ? '#ff0000' : '#00aaff', size: 0.06 },
    { key: 'rightHand' as const, color: pins.rightHand ? '#ff0000' : '#00aaff', size: 0.06 },
    { key: 'leftFoot' as const, color: pins.leftFoot ? '#ff0000' : '#ff6600', size: 0.06 },
    { key: 'rightFoot' as const, color: pins.rightFoot ? '#ff0000' : '#ff6600', size: 0.06 },
  ]

  return (
    <>
      {handles.map(({ key, color, size }) => (
        <group key={key} position={controlRig[key]}>
          <PivotControls
            scale={size * 8}
            depthTest={false}
            lineWidth={2}
            fixed
            onDrag={(_l, _deltaL, worldMatrix) => {
              tempVec.setFromMatrixPosition(worldMatrix)
              setControlRig(instanceId, { [key]: tempVec.toArray() as [number, number, number] })
            }}
          >
            <mesh
              onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                if (e.button !== 2) return
                e.stopPropagation()
                if (['leftHand', 'rightHand', 'leftFoot', 'rightFoot'].includes(key)) {
                  const pinKey = key as PinKey
                  const newPinState = !pins[pinKey]
                  setPin(instanceId, pinKey, newPinState)
                  if (newPinState) {
                    setPinnedWorldPos(instanceId, pinKey, controlRig[key])
                  }
                }
              }}
            >
              <sphereGeometry args={[size, 16, 16]} />
              <meshBasicMaterial color={color} transparent opacity={0.8} depthTest={false} />
            </mesh>
          </PivotControls>
        </group>
      ))}
    </>
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
  modelUrl: string
}

class ModelErrorBoundary extends Component<ErrorBoundaryProps, { hasError: boolean; lastModelUrl: string }> {
  state = { hasError: false, lastModelUrl: '' }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: { hasError: boolean; lastModelUrl: string }) {
    if (props.modelUrl !== state.lastModelUrl) {
      return { hasError: false, lastModelUrl: props.modelUrl }
    }
    return null
  }

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
      modelUrl={instance.modelUrl}
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
      <GroupSelectionGizmo />
    </>
  )
}
