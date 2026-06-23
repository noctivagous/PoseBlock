'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { PreviewFrame } from '@/components/PreviewFrame'
import { useStore } from '@/lib/store'
import type { PoseBlockCompositorProps } from '@/types'

const Scene = dynamic(() => import('@/components/Scene').then((m) => m.Scene), {
  ssr: false,
})

/**
 * Embeddable pose-blocking compositor: 2D backdrop + transparent WebGL mannequin overlay.
 * Standalone app uses internal Zustand store; VideoGen passes controlled props (Phase 4).
 */
export function PoseBlockCompositor({
  className,
  backdropUrl,
  frameWidth,
  frameHeight,
  instances: _instances,
  selectedIds: _selectedIds,
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

  // Phase 2: sync instances / selectedIds props ↔ store

  return (
    <div className={className ?? 'relative h-full min-h-0 w-full'}>
      <PreviewFrame backdropUrl={backdropUrl}>
        <Scene enableExport={enableExport} />
      </PreviewFrame>
      {children}
    </div>
  )
}
