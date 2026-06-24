'use client'

import { useEffect, useMemo, useState } from 'react'
import { SkeletonUtils } from 'three-stdlib'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { samplePoseFromScene } from './sampleAnimationPose'
import type { Pose } from './poses'

type LoaderState = {
  gltf: GLTF | null
  loading: boolean
  error: string | null
}

export function useAnimationPoseSample(
  url: string | null | undefined,
  clip: string | null,
  frame: number,
  enabled: boolean,
): { pose: Pose | null; loading: boolean; error: string | null } {
  const [state, setState] = useState<LoaderState>({ gltf: null, loading: false, error: null })

  useEffect(() => {
    if (!enabled || !url) {
      setState({ gltf: null, loading: false, error: null })
      return
    }

    let cancelled = false
    setState({ gltf: null, loading: true, error: null })
    const loader = new GLTFLoader()
    loader.load(
      url,
      (gltf) => {
        if (!cancelled) setState({ gltf, loading: false, error: null })
      },
      undefined,
      (err) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to load pose animation model'
          setState({ gltf: null, loading: false, error: message })
        }
      },
    )

    return () => {
      cancelled = true
    }
  }, [url, enabled])

  const pose = useMemo(() => {
    if (!enabled || !state.gltf) return null
    try {
      const scene = SkeletonUtils.clone(state.gltf.scene)
      return samplePoseFromScene(scene, state.gltf.animations, { clip, frame })
    } catch {
      return null
    }
  }, [state.gltf, clip, frame, enabled])

  return {
    pose,
    loading: state.loading,
    error: state.error,
  }
}

export function findPoseModelUrl(
  poseModels: { id: string; url: string }[],
  modelId: string,
): string | null {
  if (!modelId) return null
  return poseModels.find((m) => m.id === modelId)?.url ?? null
}
