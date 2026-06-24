'use client'

import { useStore } from '../lib/store'

type PoseGizmoModeSegmentProps = {
  className?: string
}

export function PoseGizmoModeSegment({ className }: PoseGizmoModeSegmentProps) {
  const interactionMode = useStore((s) => s.interactionMode)
  const poseGizmoMode = useStore((s) => s.poseGizmoMode)
  const set = useStore((s) => s.set)

  const setMode = (mode: 'transform' | 'pose-legacy' | 'pose-joint') => {
    if (mode === 'transform') {
      set({
        interactionMode: 'transform',
        selectedBodyPart: null,
        selectedPoseBone: null,
      })
      return
    }

    set({
      interactionMode: 'pose',
      poseGizmoMode: mode === 'pose-joint' ? 'joint' : 'legacy',
      selectedBodyPart: null,
      selectedPoseBone: null,
    })
  }

  const baseClass =
    className ??
    'grid w-full grid-cols-3 overflow-hidden rounded-md border border-white/15 bg-zinc-950/70 p-0.5'

  const btnClass =
    'rounded px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition-colors'

  return (
    <div className={baseClass} role="tablist" aria-label="Pose gizmo mode">
      <button
        type="button"
        className={`${btnClass} ${interactionMode === 'transform' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`}
        onClick={() => setMode('transform')}
      >
        Transform
      </button>
      <button
        type="button"
        className={`${btnClass} ${interactionMode === 'pose' && poseGizmoMode === 'legacy' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`}
        onClick={() => setMode('pose-legacy')}
      >
        Pose Legacy
      </button>
      <button
        type="button"
        className={`${btnClass} ${interactionMode === 'pose' && poseGizmoMode === 'joint' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`}
        onClick={() => setMode('pose-joint')}
      >
        Pose Joint
      </button>
    </div>
  )
}
