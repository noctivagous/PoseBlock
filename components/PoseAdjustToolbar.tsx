'use client'

import { composePose, summarizePoseOps } from '@/lib/poseCompose'
import {
  armNudge,
  foreArmFlex,
  foreArmTwist,
  handGesture,
  headRotate,
  legNudge,
  NUDGE,
  stanceNudge,
  torsoNudge,
} from '@/lib/poseAdjustmentActions'
import { getAllPosePresets } from '@/lib/posePresets'
import { useStore } from '@/lib/store'
import { useMemo } from 'react'

function Btn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-white/90 hover:bg-zinc-700"
    >
      {label}
    </button>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-0.5">{children}</div>
}

/** Vertical button pair (e.g. Raise above Lower) */
function Col({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col gap-0.5">{children}</div>
}

/** Side-by-side vertical pairs */
function ColPair({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-0.5">{children}</div>
}

/** Compact fieldset grouping with a legend label */
function Group({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="border border-white/10 px-1.5 pb-1.5 pt-0">
      <legend className="px-1 text-[10px] text-white/40">{label}</legend>
      {children}
    </fieldset>
  )
}

/** Two-column layout inside a Group for left/right controls */
function TwoCol({
  leftLabel,
  rightLabel,
  left,
  right,
}: {
  leftLabel: string
  rightLabel: string
  left: React.ReactNode
  right: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5">
      <span className="text-[10px] text-white/40">{leftLabel}</span>
      <span className="text-[10px] text-white/40">{rightLabel}</span>
      <div className="flex flex-col gap-0.5">{left}</div>
      <div className="flex flex-col gap-0.5">{right}</div>
    </div>
  )
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-2 text-[10px] text-white/55">
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

  const summary = useMemo(() => summarizePoseOps(poseAdjustments), [poseAdjustments])

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
      body: JSON.stringify({ name: slug, pose: composedPose, sourceBase: basePoseId, adjustments: poseAdjustments }),
    })
    if (!res.ok) { window.alert('Could not save pose preset.'); return }

    const presets = await fetch('/api/poses').then((r) => r.json())
    setBasePoseId(slug)
    set({ posePresets: presets })
  }

  const fmt = (n: number) => (n === 0 ? '' : `${n > 0 ? '+' : ''}${Math.round(n)}°`)

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-black/40 p-2 text-xs">

      {/* Undo / redo / ops count */}
      <div className="flex items-center gap-1">
        <span className="flex-1 text-[10px] text-white/50">Adjust pose · {poseAdjustments.length} ops</span>
        <button type="button" onClick={undoPoseAdjustment} disabled={poseAdjustmentPast.length === 0}
          className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-white/90 hover:bg-zinc-700 disabled:opacity-40">
          Undo
        </button>
        <button type="button" onClick={redoPoseAdjustment} disabled={poseAdjustmentFuture.length === 0}
          className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-white/90 hover:bg-zinc-700 disabled:opacity-40">
          Redo
        </button>
      </div>

      {/* Summary — fixed height to prevent layout shift */}
      <div className="flex min-h-[4.5rem] flex-col gap-0 rounded bg-zinc-900/60 px-1.5 py-1">
        {poseAdjustments.length === 0 && (
          <span className="text-[10px] text-white/25 italic">No edits yet</span>
        )}
        {poseAdjustments.length > 0 && (<>
          <SummaryLine label="Head" value={[fmt(summary.head.pitch), fmt(summary.head.yaw), fmt(summary.head.roll)].filter(Boolean).join(' ')} />
          <SummaryLine label="Torso" value={[fmt(summary.torso.pitch), fmt(summary.torso.yaw)].filter(Boolean).join(' ')} />
          <SummaryLine label="L arm" value={[summary.leftArm.raise ? `raise ${fmt(summary.leftArm.raise)}` : '', summary.leftArm.out ? `out ${fmt(summary.leftArm.out)}` : ''].filter(Boolean).join(' ')} />
          <SummaryLine label="R arm" value={[summary.rightArm.raise ? `raise ${fmt(summary.rightArm.raise)}` : '', summary.rightArm.out ? `out ${fmt(summary.rightArm.out)}` : ''].filter(Boolean).join(' ')} />
          <SummaryLine label="L forearm" value={fmt(summary.leftForeArm)} />
          <SummaryLine label="R forearm" value={fmt(summary.rightForeArm)} />
          <SummaryLine label="L hand" value={summary.leftHand ?? ''} />
          <SummaryLine label="R hand" value={summary.rightHand ?? ''} />
          <SummaryLine label="L thigh" value={[summary.leftLeg.forward ? `fwd ${fmt(summary.leftLeg.forward)}` : '', summary.leftLeg.out ? `out ${fmt(summary.leftLeg.out)}` : ''].filter(Boolean).join(' ')} />
          <SummaryLine label="R thigh" value={[summary.rightLeg.forward ? `fwd ${fmt(summary.rightLeg.forward)}` : '', summary.rightLeg.out ? `out ${fmt(summary.rightLeg.out)}` : ''].filter(Boolean).join(' ')} />
          <SummaryLine label="Stance" value={fmt(summary.stance.width)} />
        </>)}
      </div>

      {/* Head */}
      <Group label="Head">
        <Row>
          <Btn label="↺ L" onClick={() => pushPoseOp(headRotate('y', -NUDGE.head))} />
          <Btn label="↻ R" onClick={() => pushPoseOp(headRotate('y', NUDGE.head))} />
          <Btn label="↑" onClick={() => pushPoseOp(headRotate('x', -NUDGE.head))} />
          <Btn label="↓" onClick={() => pushPoseOp(headRotate('x', NUDGE.head))} />
          <Btn label="Tilt L" onClick={() => pushPoseOp(headRotate('z', NUDGE.head))} />
          <Btn label="Tilt R" onClick={() => pushPoseOp(headRotate('z', -NUDGE.head))} />
        </Row>
      </Group>

      {/* Arms (upper + forearm combined) */}
      <Group label="Arms">
        <TwoCol
          leftLabel="Left Upper arm"
          rightLabel="Right Upper arm"
          left={
            <ColPair>
              <Col>
                <Btn label="Raise" onClick={() => pushPoseOp(armNudge('left', { raise: NUDGE.armRaise }))} />
                <Btn label="Lower" onClick={() => pushPoseOp(armNudge('left', { raise: -NUDGE.armRaise }))} />
              </Col>
              <Col>
                <Btn label="Out" onClick={() => pushPoseOp(armNudge('left', { out: NUDGE.armOut }))} />
                <Btn label="In" onClick={() => pushPoseOp(armNudge('left', { out: -NUDGE.armOut }))} />
              </Col>
            </ColPair>
          }
          right={
            <ColPair>
              <Col>
                <Btn label="Raise" onClick={() => pushPoseOp(armNudge('right', { raise: NUDGE.armRaise }))} />
                <Btn label="Lower" onClick={() => pushPoseOp(armNudge('right', { raise: -NUDGE.armRaise }))} />
              </Col>
              <Col>
                <Btn label="Out" onClick={() => pushPoseOp(armNudge('right', { out: NUDGE.armOut }))} />
                <Btn label="In" onClick={() => pushPoseOp(armNudge('right', { out: -NUDGE.armOut }))} />
              </Col>
            </ColPair>
          }
        />
        <TwoCol
          leftLabel="Left Forearm"
          rightLabel="Right Forearm"
          left={
            <ColPair>
              <Col>
                <Btn label="Lift" onClick={() => pushPoseOp(foreArmFlex('left', NUDGE.foreArm))} />
                <Btn label="Lower" onClick={() => pushPoseOp(foreArmFlex('left', -NUDGE.foreArm))} />
              </Col>
              <Col>
                <Btn label="Turn Out" onClick={() => pushPoseOp(foreArmTwist('left', -NUDGE.foreArm))} />
                <Btn label="Turn In" onClick={() => pushPoseOp(foreArmTwist('left', NUDGE.foreArm))} />
              </Col>
            </ColPair>
          }
          right={
            <ColPair>
              <Col>
                <Btn label="Lift" onClick={() => pushPoseOp(foreArmFlex('right', NUDGE.foreArm))} />
                <Btn label="Lower" onClick={() => pushPoseOp(foreArmFlex('right', -NUDGE.foreArm))} />
              </Col>
              <Col>
                <Btn label="Turn Out" onClick={() => pushPoseOp(foreArmTwist('right', NUDGE.foreArm))} />
                <Btn label="Turn In" onClick={() => pushPoseOp(foreArmTwist('right', -NUDGE.foreArm))} />
              </Col>
            </ColPair>
          }
        />
      </Group>

      {/* Hands */}
      <Group label="Hands">
        <TwoCol
          leftLabel="Left"
          rightLabel="Right"
          left={<>
            <Row>
              <Btn label="Point" onClick={() => pushPoseOp(handGesture('left', 'point'))} />
              <Btn label="Fist" onClick={() => pushPoseOp(handGesture('left', 'fist'))} />
              <Btn label="Open" onClick={() => pushPoseOp(handGesture('left', 'open'))} />
            </Row>
          </>}
          right={<>
            <Row>
              <Btn label="Point" onClick={() => pushPoseOp(handGesture('right', 'point'))} />
              <Btn label="Fist" onClick={() => pushPoseOp(handGesture('right', 'fist'))} />
              <Btn label="Open" onClick={() => pushPoseOp(handGesture('right', 'open'))} />
            </Row>
          </>}
        />
      </Group>

      {/* Legs */}
      <Group label="Legs">
        <TwoCol
          leftLabel="Left thigh"
          rightLabel="Right thigh"
          left={<>
            <Row>
              <Btn label="Fwd" onClick={() => pushPoseOp(legNudge('left', { forward: NUDGE.legForward }))} />
              <Btn label="Back" onClick={() => pushPoseOp(legNudge('left', { forward: -NUDGE.legForward }))} />
            </Row>
            <Row>
              <Btn label="Out" onClick={() => pushPoseOp(legNudge('left', { out: NUDGE.legOut }))} />
              <Btn label="In" onClick={() => pushPoseOp(legNudge('left', { out: -NUDGE.legOut }))} />
            </Row>
          </>}
          right={<>
            <Row>
              <Btn label="Fwd" onClick={() => pushPoseOp(legNudge('right', { forward: NUDGE.legForward }))} />
              <Btn label="Back" onClick={() => pushPoseOp(legNudge('right', { forward: -NUDGE.legForward }))} />
            </Row>
            <Row>
              <Btn label="Out" onClick={() => pushPoseOp(legNudge('right', { out: NUDGE.legOut }))} />
              <Btn label="In" onClick={() => pushPoseOp(legNudge('right', { out: -NUDGE.legOut }))} />
            </Row>
          </>}
        />
      </Group>

      {/* Torso & Stance */}
      <Group label="Torso &amp; Stance">
        <Row>
          <Btn label="Lean fwd" onClick={() => pushPoseOp(torsoNudge(NUDGE.torso, 0))} />
          <Btn label="Lean back" onClick={() => pushPoseOp(torsoNudge(-NUDGE.torso, 0))} />
        </Row>
        <Row>
          <Btn label="Turn L" onClick={() => pushPoseOp(torsoNudge(0, NUDGE.torso))} />
          <Btn label="Turn R" onClick={() => pushPoseOp(torsoNudge(0, -NUDGE.torso))} />
        </Row>
        <Row>
          <Btn label="Wider" onClick={() => pushPoseOp(stanceNudge(NUDGE.stance))} />
          <Btn label="Narrower" onClick={() => pushPoseOp(stanceNudge(-NUDGE.stance))} />
        </Row>
      </Group>

      {/* Save / reset */}
      <div className="flex gap-1 pt-0.5">
        <button type="button" onClick={resetPoseAdjustments} disabled={poseAdjustments.length === 0}
          className="flex-1 rounded bg-zinc-800 px-2 py-1 text-xs text-white/90 hover:bg-zinc-700 disabled:opacity-40">
          Reset edits
        </button>
        <button type="button" onClick={savePose} disabled={!composedPose}
          className="flex-1 rounded bg-blue-700 px-2 py-1 text-xs text-white hover:bg-blue-600 disabled:opacity-40">
          Save pose
        </button>
      </div>
    </div>
  )
}
