import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { samplePoseFromScene } from './sampleAnimationPose'

describe('samplePoseFromScene', () => {
  it('throws when scene has no skeleton', () => {
    const scene = new THREE.Group()
    expect(() => samplePoseFromScene(scene, [], { frame: 0 })).toThrow(
      'No skeleton found in pose model.',
    )
  })

  it('clamps frame time to clip duration', () => {
    const hips = new THREE.Bone()
    hips.name = 'mixamorigHips'
    const geometry = new THREE.BufferGeometry()
    const material = new THREE.MeshBasicMaterial()
    const mesh = new THREE.SkinnedMesh(geometry, material)
    const skeleton = new THREE.Skeleton([hips])
    mesh.bind(skeleton)
    mesh.add(hips)
    const scene = new THREE.Group()
    scene.add(mesh)

    const clip = new THREE.AnimationClip('short', 0.1, [])
    const pose = samplePoseFromScene(scene, [clip], { frame: 999, fps: 30 })
    expect(pose).toBeDefined()
  })
})
