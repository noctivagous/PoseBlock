'use client'

import { composePose, summarizePoseOps } from '@/lib/poseCompose'
import {
  armNudge,
  handGesture,
  headRotate,
  NUDGE,
  stanceNudge,
  torsoNudge,
} from '@/lib/poseAdjustmentActions'
import { getAllPosePresets } from '@/lib/posePresets'
import { useStore } from '@/lib/store'
import { useMemo } from 'react'

function AdjustButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded bg-zinc-800 px-2 py-1 text-xs text-white/90 hover:bg-zinc-700"
    >
      {label}
    </button>
  )
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-2 text-xs text-white/55">
      <span>{label}</span>
      <span className="text-white/80">{value}</span>
    </div>
  )
}

export function PoseAdjustToolbar() {
  const basePoseId = useStore((s) => s.basePoseId)
  const poseAdjustments = useStore((s) => s.poseAdjustments)
  const poseAdjustmentPast = useStore((s) => s.poseAdjustmentPast)
  const poseAdjustmentFuture = useStore((s) => s.poseAdjustmentFuture)
  const posePresets = useStore((s) => s.posePresets)
  const pushPoseOp = useStore((s) => s.pushPoseOp)
  const undoPoseAdjustment = useStore((s) => s.undoPoseAdjustment)
  const redoPoseAdjustment = useStore((s) => s.redoPoseAdjustment)
  const resetPoseAdjustments = useStore((s) => s.resetPoseAdjustments)
  const setBasePoseId = useStore((s) => s.setBasePoseId)
  const set = useStore((s) => s.set)

  const availablePoses = useMemo(() => getAllPosePresets(posePresets), [posePresets])
  const composedPose = useMemo(() => {
    const base = availablePoses[basePoseId]
    if (!base) return null
    return composePose(base, poseAdjustments)
  }, [availablePoses, basePoseId, poseAdjustments])

  const summary = useMemo(
    () => summarizePoseOps(poseAdjustments),
    [poseAdjustments]
  )

  const savePose = async () => {
    if (!composedPose) return
    const suggested = `${basePoseId}_custom`
    const name = window.prompt('Save pose as (filename without .json):', suggested)
    if (!name) return

    const slug = name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_')
    if (!slug) return

    const res = await fetch('/api/poses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: slug,
        pose: composedPose,
        sourceBase: basePoseId,
        adjustments: poseAdjustments,
      }),
    })

    if (!res.ok) {
      window.alert('Could not save pose preset.')
      return
    }

    const presets = await fetch('/api/poses').then((r) => r.json())
    setBasePoseId(slug)
    set({ posePresets: presets })
  }

  const fmt = (n: number) => (n === 0 ? '' : `${n > 0 ? '+' : ''}${Math.round(n)}°`)

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-black/40 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-white/60">Adjust pose</span>
        <span className="text-xs text-white/40">{poseAdjustments.length} ops</span>
      </div>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={undoPoseAdjustment}
          disabled={poseAdjustmentPast.length === 0}
          className="flex-1 rounded bg-zinc-800 px-2 py-1 text-xs text-white/90 hover:bg-zinc-700 disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={redoPoseAdjustment}
          disabled={poseAdjustmentFuture.length === 0}
          className="flex-1 rounded bg-zinc-800 px-2 py-1 text-xs text-white/90 hover:bg-zinc-700 disabled:opacity-40"
        >
          Redo
        </button>
      </div>

      {poseAdjustments.length > 0 && (
        <div className="flex flex-col gap-0.5 rounded bg-zinc-900/60 px-2 py-1.5">
          <span className="text-xs text-white/45">Current edits</span>
          <SummaryLine
            label="Head"
            value={[fmt(summary.head.pitch), fmt(summary.head.yaw), fmt(summary.head.roll)]
              .filter(Boolean)
              .join(' ')}
          />
          <SummaryLine
            label="Torso"
            value={[fmt(summary.torso.pitch), fmt(summary.torso.yaw)].filter(Boolean).join(' ')}
          />
          <SummaryLine
            label="L arm"
            value={[
              summary.leftArm.raise ? `raise ${fmt(summary.leftArm.raise)}` : '',
              summary.leftArm.out ? `out ${fmt(summary.leftArm.out)}` : '',
              summary.leftArm.foreArm ? `fore ${fmt(summary.leftArm.foreArm)}` : '',
            ]
              .filter(Boolean)
              .join(', ')}
          />
          <SummaryLine
            label="R arm"
            value={[
              summary.rightArm.raise ? `raise ${fmt(summary.rightArm.raise)}` : '',
              summary.rightArm.out ? `out ${fmt(summary.rightArm.out)}` : '',
              summary.rightArm.foreArm ? `fore ${fmt(summary.rightArm.foreArm)}` : '',
            ]
              .filter(Boolean)
              .join(', ')}
          />
          <SummaryLine label="L hand" value={summary.leftHand ?? ''} />
          <SummaryLine label="R hand" value={summary.rightHand ?? ''} />
          <SummaryLine label="Stance" value={fmt(summary.stance.width)} />
          <SummaryLine
            label="Whole"
            value={[fmt(summary.whole.pitch), fmt(summary.whole.yaw), fmt(summary.whole.roll)]
              .filter(Boolean)
              .join(' ')}
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-xs text-white/50">Head</span>
        <div className="flex flex-wrap gap-1">
          <AdjustButton label="←" onClick={() => pushPoseOp(headRotate('y', -NUDGE.head))} />
          <AdjustButton label="→" onClick={() => pushPoseOp(headRotate('y', NUDGE.head))} />
          <AdjustButton label="↑" onClick={() => pushPoseOp(headRotate('x', -NUDGE.head))} />
          <AdjustButton label="↓" onClick={() => pushPoseOp(headRotate('x', NUDGE.head))} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-white/50">Left arm</span>
        <div className="flex flex-wrap gap-1">
          <AdjustButton label="Raise" onClick={() => pushPoseOp(armNudge('left', { raise: NUDGE.armRaise }))} />
          <AdjustButton label="Lower" onClick={() => pushPoseOp(armNudge('left', { raise: -NUDGE.armRaise }))} />
          <AdjustButton label="Out" onClick={() => pushPoseOp(armNudge('left', { out: NUDGE.armOut }))} />
          <AdjustButton label="Point" onClick={() => pushPoseOp(handGesture('left', 'point'))} />
          <AdjustButton label="Fist" onClick={() => pushPoseOp(handGesture('left', 'fist'))} />
          <AdjustButton label="Open" onClick={() => pushPoseOp(handGesture('left', 'open'))} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-white/50">Right arm</span>
        <div className="flex flex-wrap gap-1">
          <AdjustButton label="Raise" onClick={() => pushPoseOp(armNudge('right', { raise: NUDGE.armRaise }))} />
          <AdjustButton label="Lower" onClick={() => pushPoseOp(armNudge('right', { raise: -NUDGE.armRaise }))} />
          <AdjustButton label="Out" onClick={() => pushPoseOp(armNudge('right', { out: NUDGE.armOut }))} />
          <AdjustButton label="Point" onClick={() => pushPoseOp(handGesture('right', 'point'))} />
          <AdjustButton label="Fist" onClick={() => pushPoseOp(handGesture('right', 'fist'))} />
          <AdjustButton label="Open" onClick={() => pushPoseOp(handGesture('right', 'open'))} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-white/50">Torso / stance</span>
        <div className="flex flex-wrap gap-1">
          <AdjustButton label="Lean fwd" onClick={() => pushPoseOp(torsoNudge(NUDGE.torso, 0))} />
          <AdjustButton label="Lean back" onClick={() => pushPoseOp(torsoNudge(-NUDGE.torso, 0))} />
          <AdjustButton label="Turn L" onClick={() => pushPoseOp(torsoNudge(0, NUDGE.torso))} />
          <AdjustButton label="Turn R" onClick={() => pushPoseOp(torsoNudge(0, -NUDGE.torso))} />
          <AdjustButton label="Wider" onClick={() => pushPoseOp(stanceNudge(NUDGE.stance))} />
          <AdjustButton label="Narrower" onClick={() => pushPoseOp(stanceNudge(-NUDGE.stance))} />
        </div>
      </div>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={resetPoseAdjustments}
          disabled={poseAdjustments.length === 0}
          className="flex-1 rounded bg-zinc-800 px-2 py-1.5 text-xs text-white/90 hover:bg-zinc-700 disabled:opacity-40"
        >
          Reset edits
        </button>
        <button
          type="button"
          onClick={savePose}
          disabled={!composedPose}
          className="flex-1 rounded bg-blue-700 px-2 py-1.5 text-xs text-white hover:bg-blue-600 disabled:opacity-40"
        >
          Save pose
        </button>
      </div>
    </div>
  )
}
