'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { PreviewFrame } from '@/components/PreviewFrame'
import type { CharacterInstance } from '@/lib/instances'
import { useStore } from '@/lib/store'
import type { PoseBlockCompositorProps, PoseBlockInstance } from '@/types'

const Scene = dynamic(() => import('@/components/Scene').then((m) => m.Scene), {
  ssr: false,
})

function toStoreInstance(ext: PoseBlockInstance): CharacterInstance {
  return {
    id: ext.id,
    modelUrl: ext.modelUrl,
    basePoseId: ext.basePoseId,
    poseAdjustments: ext.poseAdjustments ?? [],
    poseAdjustmentPast: [],
    poseAdjustmentFuture: [],
    x: ext.x,
    y: ext.y,
    scale: ext.scale,
    rotation: ext.rotation,
    characterZ: ext.characterZ ?? 0,
    characterRotationX: ext.characterRotationX ?? 0,
    characterRotationY: ext.characterRotationY ?? ext.rotation,
  }
}

export function PoseBlockCompositor({
  className,
  backdropUrl,
  frameWidth,
  frameHeight,
  instances,
  selectedIds,
  onSelect: _onSelect,
  onInstanceChange: _onInstanceChange,
  enableExport = true,
  children,
}: PoseBlockCompositorProps) {
  const set = useStore((s) => s.set)

  useEffect(() => {
    if (backdropUrl !== undefined) {
      set({ backdropUrl })
    }
  }, [backdropUrl, set])

  useEffect(() => {
    if (frameWidth !== undefined && frameHeight !== undefined) {
      set({ frameWidth, frameHeight })
    }
  }, [frameWidth, frameHeight, set])

  useEffect(() => {
    if (instances === undefined) return
    set({ instances: instances.map(toStoreInstance) })
  }, [instances, set])

  useEffect(() => {
    if (selectedIds !== undefined) {
      set({ selectedIds })
    }
  }, [selectedIds, set])

  return (
    <div className={className ?? 'relative h-full min-h-0 w-full'}>
      <PreviewFrame backdropUrl={backdropUrl}>
        <Scene enableExport={enableExport} />
      </PreviewFrame>
      {children}
    </div>
  )
}
