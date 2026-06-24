'use client'

import { useEffect, useMemo, useRef } from 'react'
import { PivotControls, useGLTF } from '@react-three/drei'
import { type ThreeEvent, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver.js'
import { SkeletonUtils } from 'three-stdlib'
import type { ControlRig } from '../lib/instances'
import { MIXAMO_BONES, POSES, findSkeletonBone, lerpPose } from '../lib/poses'
import { useStore } from '../lib/store'

const MODEL_OFFSET = { scale: 1.8, y: -0.9 }
const tempVec = new THREE.Vector3()
const tempQuat = new THREE.Quaternion()

export default function Character() {
  const groupRef = useRef<THREE.Group>(null)
  const skinnedRef = useRef<THREE.SkinnedMesh | null>(null)
  const solverRef = useRef<CCDIKSolver | null>(null)
  const fkPoseRef = useRef<Record<string, number[]>>({})

  const {
    modelUrl,
    currentPose,
    characterX,
    characterY,
    characterScale,
    mode,
    controlRig,
    setControlRig,
    pins,
    pinnedWorldPos,
    setPinnedWorldPos,
    ikBlend,
    setCharacterError,
  } = useStore()

  const { scene: gltfScene } = useGLTF(modelUrl || '/models/X%20Bot.glb')
  const clonedScene = useMemo(() => SkeletonUtils.clone(gltfScene), [gltfScene])

  const getBoneIndex = (skeleton: THREE.Skeleton, name: string) =>
    skeleton.bones.findIndex((b) => b.name === name || b.name === `mixamorig:${name}`)

  const saveFKPose = (skeleton: THREE.Skeleton) => {
    const pose: Record<string, number[]> = {}
    MIXAMO_BONES.forEach((name) => {
      const bone = findSkeletonBone(skeleton, name)
      if (bone) pose[name] = bone.quaternion.toArray() as number[]
    })
    fkPoseRef.current = pose
    return pose
  }

  const poseToControlRig = (poseName: string, skeleton: THREE.Skeleton): Omit<ControlRig, 'initialized'> => {
    const pose = POSES[poseName]
    if (pose) {
      lerpPose(skeleton, pose, 1)
      skeleton.update()
    }

    const getWorldPos = (boneName: string): [number, number, number] => {
      const bone = findSkeletonBone(skeleton, boneName)
      if (!bone) return [0, 0, 0]
      bone.getWorldPosition(tempVec)
      return tempVec.toArray() as [number, number, number]
    }

    return {
      head: getWorldPos('Head'),
      chest: getWorldPos('Spine2'),
      hips: getWorldPos('Hips'),
      leftHand: getWorldPos('LeftHand'),
      rightHand: getWorldPos('RightHand'),
      leftFoot: getWorldPos('LeftFoot'),
      rightFoot: getWorldPos('RightFoot'),
    }
  }

  useEffect(() => {
    const skinned = clonedScene.getObjectByProperty('isSkinnedMesh', true) as
      | THREE.SkinnedMesh
      | undefined

    if (!skinned) {
      setCharacterError('No skeleton found')
      return
    }

    skinnedRef.current = skinned
    const skeleton = skinned.skeleton

    skeleton.bones.forEach((b: THREE.Bone) => {
      b.name = b.name.replace('mixamorig:', '')
    })

    const chains = [
      {
        target: getBoneIndex(skeleton, 'LeftHand'),
        effector: getBoneIndex(skeleton, 'LeftHand'),
        links: [
          {
            index: getBoneIndex(skeleton, 'LeftForeArm'),
            rotationMin: new THREE.Vector3(0, -0.2, -0.2),
            rotationMax: new THREE.Vector3(2.4, 0.2, 0.2),
          },
          {
            index: getBoneIndex(skeleton, 'LeftArm'),
            rotationMin: new THREE.Vector3(-1.5, -1, -1),
            rotationMax: new THREE.Vector3(1.5, 1, 1),
          },
          { index: getBoneIndex(skeleton, 'LeftShoulder') },
        ].filter((l) => l.index >= 0),
      },
      {
        target: getBoneIndex(skeleton, 'RightHand'),
        effector: getBoneIndex(skeleton, 'RightHand'),
        links: [
          {
            index: getBoneIndex(skeleton, 'RightForeArm'),
            rotationMin: new THREE.Vector3(0, -0.2, -0.2),
            rotationMax: new THREE.Vector3(2.4, 0.2, 0.2),
          },
          {
            index: getBoneIndex(skeleton, 'RightArm'),
            rotationMin: new THREE.Vector3(-1.5, -1, -1),
            rotationMax: new THREE.Vector3(1.5, 1, 1),
          },
          { index: getBoneIndex(skeleton, 'RightShoulder') },
        ].filter((l) => l.index >= 0),
      },
      {
        target: getBoneIndex(skeleton, 'LeftFoot'),
        effector: getBoneIndex(skeleton, 'LeftFoot'),
        links: [
          {
            index: getBoneIndex(skeleton, 'LeftLeg'),
            rotationMin: new THREE.Vector3(0, -0.1, -0.1),
            rotationMax: new THREE.Vector3(2.6, 0.1, 0.1),
          },
          {
            index: getBoneIndex(skeleton, 'LeftUpLeg'),
            rotationMin: new THREE.Vector3(-1.8, -0.5, -0.5),
            rotationMax: new THREE.Vector3(0.5, 0.5, 0.5),
          },
        ].filter((l) => l.index >= 0),
      },
      {
        target: getBoneIndex(skeleton, 'RightFoot'),
        effector: getBoneIndex(skeleton, 'RightFoot'),
        links: [
          {
            index: getBoneIndex(skeleton, 'RightLeg'),
            rotationMin: new THREE.Vector3(0, -0.1, -0.1),
            rotationMax: new THREE.Vector3(2.6, 0.1, 0.1),
          },
          {
            index: getBoneIndex(skeleton, 'RightUpLeg'),
            rotationMin: new THREE.Vector3(-1.8, -0.5, -0.5),
            rotationMax: new THREE.Vector3(0.5, 0.5, 0.5),
          },
        ].filter((l) => l.index >= 0),
      },
      {
        target: getBoneIndex(skeleton, 'Head'),
        effector: getBoneIndex(skeleton, 'Head'),
        links: [
          {
            index: getBoneIndex(skeleton, 'Neck'),
            rotationMin: new THREE.Vector3(-0.5, -0.8, -0.5),
            rotationMax: new THREE.Vector3(0.5, 0.8, 0.5),
          },
        ].filter((l) => l.index >= 0),
      },
      {
        target: getBoneIndex(skeleton, 'Spine2'),
        effector: getBoneIndex(skeleton, 'Spine2'),
        links: [
          {
            index: getBoneIndex(skeleton, 'Spine1'),
            rotationMin: new THREE.Vector3(-0.3, -0.3, -0.3),
            rotationMax: new THREE.Vector3(0.3, 0.3, 0.3),
          },
          { index: getBoneIndex(skeleton, 'Spine') },
        ].filter((l) => l.index >= 0),
      },
    ].filter((c) => c.target >= 0)

    solverRef.current = new CCDIKSolver(skinned, chains as never)

    if (!controlRig.initialized) {
      const rig = poseToControlRig(currentPose, skeleton)
      setControlRig({ ...rig, initialized: true })
    }

    setCharacterError(null)
  }, [clonedScene, modelUrl, currentPose, controlRig.initialized, setCharacterError, setControlRig])

  useEffect(() => {
    if (mode === 'controlRig' && skinnedRef.current) {
      const rig = poseToControlRig(currentPose, skinnedRef.current.skeleton)
      setControlRig(rig)
    }
  }, [currentPose, mode, setControlRig])

  useFrame(() => {
    if (!skinnedRef.current || !solverRef.current) return
    const skeleton = skinnedRef.current.skeleton

    if (mode === 'preset') {
      const pose = POSES[currentPose]
      if (pose) lerpPose(skeleton, pose, 1)
    } else if (mode === 'controlRig') {
      const fkPose = saveFKPose(skeleton)

      const setTarget = (
        boneName: string,
        pos: [number, number, number],
        isPinned: boolean,
        pinnedPos: [number, number, number],
      ) => {
        const bone = findSkeletonBone(skeleton, boneName)
        if (!bone) return

        const worldPos = new THREE.Vector3().fromArray(isPinned ? pinnedPos : pos)
        if (bone.parent) {
          bone.parent.worldToLocal(worldPos)
        }
        bone.position.copy(worldPos)
      }

      setTarget('LeftHand', controlRig.leftHand, pins.leftHand, pinnedWorldPos.leftHand)
      setTarget('RightHand', controlRig.rightHand, pins.rightHand, pinnedWorldPos.rightHand)
      setTarget('LeftFoot', controlRig.leftFoot, pins.leftFoot, pinnedWorldPos.leftFoot)
      setTarget('RightFoot', controlRig.rightFoot, pins.rightFoot, pinnedWorldPos.rightFoot)
      setTarget('Head', controlRig.head, false, [0, 0, 0])
      setTarget('Spine2', controlRig.chest, false, [0, 0, 0])
      setTarget('Hips', controlRig.hips, false, [0, 0, 0])

      solverRef.current.update()

      const blendLimb = (boneNames: string[], blend: number) => {
        if (blend >= 0.999) return
        boneNames.forEach((name) => {
          const bone = findSkeletonBone(skeleton, name)
          if (!bone || !fkPose[name]) return
          const fkQ = tempQuat.fromArray(fkPose[name])
          bone.quaternion.slerpQuaternions(fkQ, bone.quaternion, blend)
        })
      }

      blendLimb(['LeftArm', 'LeftForeArm', 'LeftHand'], ikBlend.leftArm)
      blendLimb(['RightArm', 'RightForeArm', 'RightHand'], ikBlend.rightArm)
      blendLimb(['LeftUpLeg', 'LeftLeg', 'LeftFoot'], ikBlend.leftLeg)
      blendLimb(['RightUpLeg', 'RightLeg', 'RightFoot'], ikBlend.rightLeg)

      const updatePin = (boneName: string, pinKey: keyof typeof pins) => {
        if (pins[pinKey]) {
          const bone = findSkeletonBone(skeleton, boneName)
          if (bone) {
            bone.getWorldPosition(tempVec)
            setPinnedWorldPos(pinKey, tempVec.toArray() as [number, number, number])
          }
        }
      }
      updatePin('LeftFoot', 'leftFoot')
      updatePin('RightFoot', 'rightFoot')
      updatePin('LeftHand', 'leftHand')
      updatePin('RightHand', 'rightHand')
    }

    skeleton.update()
  })

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(characterX, characterY, 0)
      groupRef.current.scale.setScalar(characterScale)
    }
  }, [characterX, characterY, characterScale])

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} scale={MODEL_OFFSET.scale} position-y={MODEL_OFFSET.y} />
      {mode === 'controlRig' && <ControlRigHandles />}
    </group>
  )
}

function ControlRigHandles() {
  const { controlRig, setControlRig, pins, setPin, setPinnedWorldPos } = useStore()

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
              setControlRig({ [key]: tempVec.toArray() as [number, number, number] })
            }}
          >
            <mesh
              onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                if (e.button !== 2) return
                e.stopPropagation()
                if (['leftHand', 'rightHand', 'leftFoot', 'rightFoot'].includes(key)) {
                  const pinKey = key as keyof typeof pins
                  const newPinState = !pins[pinKey]
                  setPin(pinKey, newPinState)
                  if (newPinState) {
                    setPinnedWorldPos(pinKey, controlRig[key])
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

useGLTF.preload('/models/X%20Bot.glb')
useGLTF.preload('/models/Y%20Bot.glb')
