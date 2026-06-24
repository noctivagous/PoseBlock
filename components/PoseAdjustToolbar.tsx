'use client'

import { composePose, summarizePoseOps, type PoseOp } from '../lib/poseCompose'
import {
  armNudge,
  foreArmFlex,
  foreArmTwist,
  handGesture,
  handRotate,
  headRotate,
  legNudge,
  NUDGE,
  stanceNudge,
  thighTwist,
  torsoNudge,
  upperArmTwist,
  wholeRotate,
} from '../lib/poseAdjustmentActions'
import { dollyAnchor } from '../lib/characterTransform'
import { getAllPosePresets } from '../lib/posePresets'
import { useStore } from '../lib/store'
import { findPoseModelUrl, useAnimationPoseSample } from '../lib/useAnimationPoseSample'
import { useMemo } from 'react'

const MIN_SCALE = 0.15
const MAX_SCALE = 4
const SCALE_STEP = 0.08

function Btn({
  label,
  onClick,
  tone = 'default',
}: {
  label: string
  onClick: () => void
  tone?: 'default' | 'light'
}) {
  const toneClass =
    tone === 'light'
      ? 'bg-zinc-700/70 text-white/75 hover:bg-zinc-600/80'
      : 'bg-zinc-800 text-white/90 hover:bg-zinc-700'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 select-none rounded px-1.5 py-0.5 text-xs ${toneClass}`}
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
    <div className="flex justify-between gap-2 text-[10px] leading-[14px] text-white/55">
      <span>{label}</span>
      <span className="text-white/80">{value}</span>
    </div>
  )
}

function LegColPair({
  side,
  part,
  tone = 'default',
  pushPoseOp,
}: {
  side: 'left' | 'right'
  part: 'thigh' | 'lower' | 'foot'
  tone?: 'default' | 'light'
  pushPoseOp: (op: PoseOp) => void
}) {
  return (
    <ColPair>
      <Col>
        <Btn tone={tone} label="Fwd" onClick={() => pushPoseOp(legNudge(side, { forward: NUDGE.legForward }, part))} />
        <Btn tone={tone} label="Back" onClick={() => pushPoseOp(legNudge(side, { forward: -NUDGE.legForward }, part))} />
      </Col>
      <Col>
        <Btn tone={tone} label="Out" onClick={() => pushPoseOp(legNudge(side, { out: NUDGE.legOut }, part))} />
        <Btn tone={tone} label="In" onClick={() => pushPoseOp(legNudge(side, { out: -NUDGE.legOut }, part))} />
      </Col>
      {part === 'thigh' && (
        <Col>
          <Btn tone="light" label="Turn Out" onClick={() => pushPoseOp(thighTwist(side, -NUDGE.legTwist))} />
          <Btn tone="light" label="Turn In" onClick={() => pushPoseOp(thighTwist(side, NUDGE.legTwist))} />
        </Col>
      )}
    </ColPair>
  )
}

export function PoseAdjustToolbar() {
  const instances = useStore((s) => s.instances)
  const selectedIds = useStore((s) => s.selectedIds)
  const mode = useStore((s) => s.mode)
  const primaryId = selectedIds[0] ?? null
  const primary = instances.find((i) => i.id === primaryId)
  const posePresets = useStore((s) => s.posePresets)
  const poseModels = useStore((s) => s.poseModels)
  const pushPoseOp = useStore((s) => s.pushPoseOp)
  const undoPoseAdjustment = useStore((s) => s.undoPoseAdjustment)
  const redoPoseAdjustment = useStore((s) => s.redoPoseAdjustment)
  const resetPoseAdjustments = useStore((s) => s.resetPoseAdjustments)
  const setBasePoseId = useStore((s) => s.setBasePoseId)
  const setInstanceIkBlend = useStore((s) => s.setInstanceIkBlend)
  const updateSelectedInstances = useStore((s) => s.updateSelectedInstances)
  const set = useStore((s) => s.set)

  const basePoseId = primary?.basePoseId ?? ''
  const poseAdjustments = primary?.poseAdjustments ?? []

  const selectedInstances = useMemo(
    () => instances.filter((i) => selectedIds.includes(i.id)),
    [instances, selectedIds],
  )
  const canUndo = selectedInstances.some((i) => i.poseAdjustmentPast.length > 0)
  const canRedo = selectedInstances.some((i) => i.poseAdjustmentFuture.length > 0)

  const animationModelUrl = useMemo(() => {
    if (!primary || primary.poseSourceMode !== 'animation') return null
    return findPoseModelUrl(poseModels, primary.animationPoseModelId)
  }, [primary, poseModels])

  const useAnimation =
    primary?.poseSourceMode === 'animation' && Boolean(animationModelUrl)

  const { pose: animationPose } = useAnimationPoseSample(
    animationModelUrl,
    primary?.animationClip ?? null,
    primary?.animationFrame ?? 0,
    useAnimation,
  )

  const availablePoses = useMemo(() => getAllPosePresets(posePresets), [posePresets])
  const composedPose = useMemo(() => {
    if (!primary) return null
    let base =
      primary.poseSourceMode === 'animation'
        ? animationPose
        : availablePoses[primary.basePoseId]
    if (!base || Object.keys(base).length === 0) base = availablePoses.t_pose
    if (!base) return null
    return composePose(base, poseAdjustments)
  }, [primary, availablePoses, animationPose, poseAdjustments])

  const summary = useMemo(() => summarizePoseOps(poseAdjustments), [poseAdjustments])

  if (!primary) {
    return null
  }

  if (mode === 'controlRig') {
    const sliderClass = 'w-full accent-sky-400'

    return (
      <div className="flex flex-col gap-2 rounded-lg bg-black/40 p-3 text-xs">
        <div className="text-[11px] text-white/75">Control Rig FK/IK Blend</div>
        <label className="flex flex-col gap-1 text-white/80">
          <span>Left Arm: {primary.ikBlend.leftArm.toFixed(2)}</span>
          <input
            className={sliderClass}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={primary.ikBlend.leftArm}
            onChange={(e) => setInstanceIkBlend(primary.id, 'leftArm', Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-white/80">
          <span>Right Arm: {primary.ikBlend.rightArm.toFixed(2)}</span>
          <input
            className={sliderClass}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={primary.ikBlend.rightArm}
            onChange={(e) => setInstanceIkBlend(primary.id, 'rightArm', Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-white/80">
          <span>Left Leg: {primary.ikBlend.leftLeg.toFixed(2)}</span>
          <input
            className={sliderClass}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={primary.ikBlend.leftLeg}
            onChange={(e) => setInstanceIkBlend(primary.id, 'leftLeg', Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-white/80">
          <span>Right Leg: {primary.ikBlend.rightLeg.toFixed(2)}</span>
          <input
            className={sliderClass}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={primary.ikBlend.rightLeg}
            onChange={(e) => setInstanceIkBlend(primary.id, 'rightLeg', Number(e.target.value))}
          />
        </label>
      </div>
    )
  }

  const scaleUp = () =>
    updateSelectedInstances((inst) => ({
      scale: Math.min(MAX_SCALE, inst.scale + SCALE_STEP),
    }))
  const scaleDown = () =>
    updateSelectedInstances((inst) => ({
      scale: Math.max(MIN_SCALE, inst.scale - SCALE_STEP),
    }))

  const dolly = (direction: 1 | -1) => {
    updateSelectedInstances((inst) =>
      dollyAnchor({ scale: inst.scale }, inst.characterZ, direction),
    )
  }

  const savePose = async () => {
    if (!composedPose) return
    const suggested =
      primary.poseSourceMode === 'animation'
        ? `${primary.animationPoseModelId || 'anim'}_f${primary.animationFrame ?? 0}_custom`
        : `${basePoseId}_custom`
    const name = window.prompt('Save pose as (filename without .json):', suggested)
    if (!name) return
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_')
    if (!slug) return

    const sourceBase =
      primary.poseSourceMode === 'animation'
        ? `anim:${primary.animationPoseModelId}:${primary.animationClip ?? ''}:${primary.animationFrame ?? 0}`
        : basePoseId

    const res = await fetch('/api/poses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: slug, pose: composedPose, sourceBase, adjustments: poseAdjustments }),
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
        <button type="button" onClick={undoPoseAdjustment} disabled={!canUndo}
          className="select-none rounded bg-zinc-800 px-2 py-0.5 text-xs text-white/90 hover:bg-zinc-700 disabled:opacity-40">
          Undo
        </button>
        <button type="button" onClick={redoPoseAdjustment} disabled={!canRedo}
          className="select-none rounded bg-zinc-800 px-2 py-0.5 text-xs text-white/90 hover:bg-zinc-700 disabled:opacity-40">
          Redo
        </button>
      </div>

      {/* Summary — fixed 4-line height, scroll when longer */}
      <div className="h-16 overflow-y-auto rounded bg-zinc-900/60 px-1.5 py-1">
        {poseAdjustments.length === 0 && (
          <span className="text-[10px] leading-[14px] text-white/25 italic">No edits yet</span>
        )}
        {poseAdjustments.length > 0 && (<>
          <SummaryLine label="Whole" value={[fmt(summary.whole.pitch), fmt(summary.whole.yaw), fmt(summary.whole.roll)].filter(Boolean).join(' ')} />
          <SummaryLine label="Head" value={[fmt(summary.head.pitch), fmt(summary.head.yaw), fmt(summary.head.roll)].filter(Boolean).join(' ')} />
          <SummaryLine label="Torso" value={[fmt(summary.torso.pitch), fmt(summary.torso.yaw), fmt(summary.torso.roll)].filter(Boolean).join(' ')} />
          <SummaryLine label="L arm" value={[summary.leftArm.raise ? `raise ${fmt(summary.leftArm.raise)}` : '', summary.leftArm.out ? `out ${fmt(summary.leftArm.out)}` : '', summary.leftArm.twist ? `twist ${fmt(summary.leftArm.twist)}` : ''].filter(Boolean).join(' ')} />
          <SummaryLine label="R arm" value={[summary.rightArm.raise ? `raise ${fmt(summary.rightArm.raise)}` : '', summary.rightArm.out ? `out ${fmt(summary.rightArm.out)}` : '', summary.rightArm.twist ? `twist ${fmt(summary.rightArm.twist)}` : ''].filter(Boolean).join(' ')} />
          <SummaryLine label="L forearm" value={fmt(summary.leftForeArm)} />
          <SummaryLine label="R forearm" value={fmt(summary.rightForeArm)} />
          <SummaryLine label="L hand" value={[summary.leftHand ?? '', [fmt(summary.leftHandRot.pitch), fmt(summary.leftHandRot.yaw)].filter(Boolean).join(' ')].filter(Boolean).join(' · ')} />
          <SummaryLine label="R hand" value={[summary.rightHand ?? '', [fmt(summary.rightHandRot.pitch), fmt(summary.rightHandRot.yaw)].filter(Boolean).join(' ')].filter(Boolean).join(' · ')} />
          <SummaryLine label="L thigh" value={[summary.leftLeg.forward ? `fwd ${fmt(summary.leftLeg.forward)}` : '', summary.leftLeg.out ? `out ${fmt(summary.leftLeg.out)}` : '', summary.leftLeg.twist ? `twist ${fmt(summary.leftLeg.twist)}` : ''].filter(Boolean).join(' ')} />
          <SummaryLine label="R thigh" value={[summary.rightLeg.forward ? `fwd ${fmt(summary.rightLeg.forward)}` : '', summary.rightLeg.out ? `out ${fmt(summary.rightLeg.out)}` : '', summary.rightLeg.twist ? `twist ${fmt(summary.rightLeg.twist)}` : ''].filter(Boolean).join(' ')} />
          <SummaryLine label="L lower leg" value={[summary.leftLowerLeg.forward ? `fwd ${fmt(summary.leftLowerLeg.forward)}` : '', summary.leftLowerLeg.out ? `out ${fmt(summary.leftLowerLeg.out)}` : ''].filter(Boolean).join(' ')} />
          <SummaryLine label="R lower leg" value={[summary.rightLowerLeg.forward ? `fwd ${fmt(summary.rightLowerLeg.forward)}` : '', summary.rightLowerLeg.out ? `out ${fmt(summary.rightLowerLeg.out)}` : ''].filter(Boolean).join(' ')} />
          <SummaryLine label="L foot" value={[summary.leftFoot.forward ? `fwd ${fmt(summary.leftFoot.forward)}` : '', summary.leftFoot.out ? `out ${fmt(summary.leftFoot.out)}` : ''].filter(Boolean).join(' ')} />
          <SummaryLine label="R foot" value={[summary.rightFoot.forward ? `fwd ${fmt(summary.rightFoot.forward)}` : '', summary.rightFoot.out ? `out ${fmt(summary.rightFoot.out)}` : ''].filter(Boolean).join(' ')} />
          <SummaryLine label="Stance" value={fmt(summary.stance.width)} />
        </>)}
      </div>

      {/* Entire body */}
      <Group label="Entire Body">
        <ColPair>
          <Col>
            <Btn label="↑" onClick={() => pushPoseOp(wholeRotate('x', -NUDGE.whole))} />
            <Btn label="↓" onClick={() => pushPoseOp(wholeRotate('x', NUDGE.whole))} />
          </Col>
          <Col>
            <Btn label="↺ L" onClick={() => pushPoseOp(wholeRotate('y', -NUDGE.whole))} />
            <Btn label="↻ R" onClick={() => pushPoseOp(wholeRotate('y', NUDGE.whole))} />
          </Col>
          <Col>
            <Btn label="Tilt L" onClick={() => pushPoseOp(wholeRotate('z', NUDGE.whole))} />
            <Btn label="Tilt R" onClick={() => pushPoseOp(wholeRotate('z', -NUDGE.whole))} />
          </Col>
          <Col>
            <Btn label="Larger" onClick={scaleUp} />
            <Btn label="Smaller" onClick={scaleDown} />
          </Col>
          <Col>
            <Btn label="Toward" onClick={() => dolly(1)} />
            <Btn label="Away" onClick={() => dolly(-1)} />
          </Col>
        </ColPair>
      </Group>

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
              <Col>
                <Btn tone="light" label="Turn Out" onClick={() => pushPoseOp(upperArmTwist('left', -NUDGE.armTwist))} />
                <Btn tone="light" label="Turn In" onClick={() => pushPoseOp(upperArmTwist('left', NUDGE.armTwist))} />
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
              <Col>
                <Btn tone="light" label="Turn Out" onClick={() => pushPoseOp(upperArmTwist('right', -NUDGE.armTwist))} />
                <Btn tone="light" label="Turn In" onClick={() => pushPoseOp(upperArmTwist('right', NUDGE.armTwist))} />
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
                <Btn tone="light" label="Lift" onClick={() => pushPoseOp(foreArmFlex('left', NUDGE.foreArm))} />
                <Btn tone="light" label="Lower" onClick={() => pushPoseOp(foreArmFlex('left', -NUDGE.foreArm))} />
              </Col>
              <Col>
                <Btn tone="light" label="Turn Out" onClick={() => pushPoseOp(foreArmTwist('left', -NUDGE.foreArm))} />
                <Btn tone="light" label="Turn In" onClick={() => pushPoseOp(foreArmTwist('left', NUDGE.foreArm))} />
              </Col>
            </ColPair>
          }
          right={
            <ColPair>
              <Col>
                <Btn tone="light" label="Lift" onClick={() => pushPoseOp(foreArmFlex('right', NUDGE.foreArm))} />
                <Btn tone="light" label="Lower" onClick={() => pushPoseOp(foreArmFlex('right', -NUDGE.foreArm))} />
              </Col>
              <Col>
                <Btn tone="light" label="Turn Out" onClick={() => pushPoseOp(foreArmTwist('right', NUDGE.foreArm))} />
                <Btn tone="light" label="Turn In" onClick={() => pushPoseOp(foreArmTwist('right', -NUDGE.foreArm))} />
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
          left={
            <>
              <ColPair>
                <Col>
                  <Btn label="Up" onClick={() => pushPoseOp(handRotate('left', 'up'))} />
                  <Btn label="Down" onClick={() => pushPoseOp(handRotate('left', 'down'))} />
                </Col>
                <Col>
                  <Btn label="Out" onClick={() => pushPoseOp(handRotate('left', 'out'))} />
                  <Btn label="In" onClick={() => pushPoseOp(handRotate('left', 'in'))} />
                </Col>
              </ColPair>
              <Row>
                <Btn label="Point" onClick={() => pushPoseOp(handGesture('left', 'point'))} />
                <Btn label="Fist" onClick={() => pushPoseOp(handGesture('left', 'fist'))} />
                <Btn label="Open" onClick={() => pushPoseOp(handGesture('left', 'open'))} />
              </Row>
            </>
          }
          right={
            <>
              <ColPair>
                <Col>
                  <Btn label="Up" onClick={() => pushPoseOp(handRotate('right', 'up'))} />
                  <Btn label="Down" onClick={() => pushPoseOp(handRotate('right', 'down'))} />
                </Col>
                <Col>
                  <Btn label="Out" onClick={() => pushPoseOp(handRotate('right', 'out'))} />
                  <Btn label="In" onClick={() => pushPoseOp(handRotate('right', 'in'))} />
                </Col>
              </ColPair>
              <Row>
                <Btn label="Point" onClick={() => pushPoseOp(handGesture('right', 'point'))} />
                <Btn label="Fist" onClick={() => pushPoseOp(handGesture('right', 'fist'))} />
                <Btn label="Open" onClick={() => pushPoseOp(handGesture('right', 'open'))} />
              </Row>
            </>
          }
        />
      </Group>

      {/* Legs */}
      <Group label="Legs">
        <TwoCol
          leftLabel="Left thigh"
          rightLabel="Right thigh"
          left={<LegColPair side="left" part="thigh" pushPoseOp={pushPoseOp} />}
          right={<LegColPair side="right" part="thigh" pushPoseOp={pushPoseOp} />}
        />
        <TwoCol
          leftLabel="Left lower leg"
          rightLabel="Right lower leg"
          left={<LegColPair side="left" part="lower" tone="light" pushPoseOp={pushPoseOp} />}
          right={<LegColPair side="right" part="lower" tone="light" pushPoseOp={pushPoseOp} />}
        />
      </Group>

      {/* Feet */}
      <Group label="Feet">
        <TwoCol
          leftLabel="Left foot"
          rightLabel="Right foot"
          left={<LegColPair side="left" part="foot" tone="light" pushPoseOp={pushPoseOp} />}
          right={<LegColPair side="right" part="foot" tone="light" pushPoseOp={pushPoseOp} />}
        />
      </Group>

      {/* Torso & Stance */}
      <Group label="Torso &amp; Stance">
        <ColPair>
          <Col>
            <Btn label="Lean fwd" onClick={() => pushPoseOp(torsoNudge(NUDGE.torso, 0))} />
            <Btn label="Lean back" onClick={() => pushPoseOp(torsoNudge(-NUDGE.torso, 0))} />
          </Col>
          <Col>
            <Btn label="Turn L" onClick={() => pushPoseOp(torsoNudge(0, NUDGE.torso))} />
            <Btn label="Turn R" onClick={() => pushPoseOp(torsoNudge(0, -NUDGE.torso))} />
          </Col>
          <Col>
            <Btn label="Lean L" onClick={() => pushPoseOp(torsoNudge(0, 0, -NUDGE.torso))} />
            <Btn label="Lean R" onClick={() => pushPoseOp(torsoNudge(0, 0, NUDGE.torso))} />
          </Col>
          <Col>
            <Btn label="Wider" onClick={() => pushPoseOp(stanceNudge(NUDGE.stance))} />
            <Btn label="Narrower" onClick={() => pushPoseOp(stanceNudge(-NUDGE.stance))} />
          </Col>
        </ColPair>
      </Group>

      {/* Save / reset */}
      <div className="flex gap-1 pt-0.5">
        <button type="button" onClick={resetPoseAdjustments} disabled={poseAdjustments.length === 0}
          className="flex-1 select-none rounded bg-zinc-800 px-2 py-1 text-xs text-white/90 hover:bg-zinc-700 disabled:opacity-40">
          Reset edits
        </button>
        <button type="button" onClick={savePose} disabled={!composedPose}
          className="flex-1 select-none rounded bg-blue-700 px-2 py-1 text-xs text-white hover:bg-blue-600 disabled:opacity-40">
          Save pose
        </button>
      </div>
    </div>
  )
}
