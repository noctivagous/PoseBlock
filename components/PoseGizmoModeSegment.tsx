'use client'

import { useStore } from '../lib/store'

type PoseGizmoModeSegmentProps = {
  className?: string
}

export function PoseGizmoModeSegment({ className }: PoseGizmoModeSegmentProps) {
  const interactionMode = useStore((s) => s.interactionMode)
  const poseGizmoMode = useStore((s) => s.poseGizmoMode)
  const mode = useStore((s) => s.mode)
  const setModeState = useStore((s) => s.setMode)
  const set = useStore((s) => s.set)

  const setSegmentMode = (
    nextMode: 'transform' | 'pose-legacy' | 'pose-joint' | 'pose-cylinder' | 'control-rig',
  ) => {
    if (nextMode === 'control-rig') {
      setModeState('controlRig')
      set({
        interactionMode: 'transform',
        selectedBodyPart: null,
        selectedPoseBone: null,
      })
      return
    }

    setModeState('preset')

    if (nextMode === 'transform') {
      set({
        interactionMode: 'transform',
        selectedBodyPart: null,
        selectedPoseBone: null,
      })
      return
    }

    set({
      interactionMode: 'pose',
      poseGizmoMode:
        nextMode === 'pose-joint' ? 'joint' : nextMode === 'pose-cylinder' ? 'cylinder' : 'legacy',
      selectedBodyPart: null,
      selectedPoseBone: null,
    })
  }

  const baseClass =
    className ??
    'grid w-full grid-cols-5 overflow-hidden rounded-md border border-white/15 bg-zinc-950/70 p-0.5'

  const btnClass =
    'rounded px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition-colors'

  return (
    <div className={baseClass} role="tablist" aria-label="Pose gizmo mode">
      <button
        type="button"
        className={`${btnClass} ${interactionMode === 'transform' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`}
        onClick={() => setSegmentMode('transform')}
      >
        Transform
      </button>
      <button
        type="button"
        className={`${btnClass} ${interactionMode === 'pose' && poseGizmoMode === 'legacy' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`}
        onClick={() => setSegmentMode('pose-legacy')}
      >
        Pose Legacy
      </button>
      <button
        type="button"
        className={`${btnClass} ${interactionMode === 'pose' && poseGizmoMode === 'joint' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`}
        onClick={() => setSegmentMode('pose-joint')}
      >
        Pose Joint
      </button>
      <button
        type="button"
        className={`${btnClass} ${interactionMode === 'pose' && poseGizmoMode === 'cylinder' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`}
        onClick={() => setSegmentMode('pose-cylinder')}
      >
        Pose Cylinder
      </button>
      <button
        type="button"
        className={`${btnClass} ${mode === 'controlRig' ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`}
        onClick={() => setSegmentMode('control-rig')}
      >
        Control Rig
      </button>
    </div>
  )
}
