'use client'

import { useMemo } from 'react'
import { getAllPosePresets } from '../lib/posePresets'
import type { PoseSourceMode } from '../lib/instances'
import { useStore } from '../lib/store'

const selectClass = 'rounded bg-zinc-800 px-2 py-1.5 text-white'
const labelClass = 'text-xs text-white/60'

export function PoseSourceControls() {
  const instances = useStore((s) => s.instances)
  const selectedIds = useStore((s) => s.selectedIds)
  const posePresets = useStore((s) => s.posePresets)
  const poseModels = useStore((s) => s.poseModels)
  const setBasePoseId = useStore((s) => s.setBasePoseId)
  const setPoseSourceMode = useStore((s) => s.setPoseSourceMode)
  const setAnimationPoseModel = useStore((s) => s.setAnimationPoseModel)
  const setAnimationFrame = useStore((s) => s.setAnimationFrame)
  const setAnimationClip = useStore((s) => s.setAnimationClip)

  const primaryId = selectedIds[0] ?? null
  const primary = instances.find((i) => i.id === primaryId)
  const availablePoses = useMemo(() => getAllPosePresets(posePresets), [posePresets])
  const selectedCount = selectedIds.length
  const adjustmentCount = primary?.poseAdjustments.length ?? 0

  if (!primary) return null

  const poseSourceMode = primary.poseSourceMode
  const selectedPoseModel = poseModels.find((m) => m.id === primary.animationPoseModelId)
  const clips = selectedPoseModel?.clips ?? []
  const activeClipName =
    primary.animationClip ?? clips[0]?.name ?? null
  const activeClip = clips.find((c) => c.name === activeClipName) ?? clips[0]
  const maxFrame = Math.max(0, (activeClip?.frameCount ?? 1) - 1)
  const frame = Math.min(primary.animationFrame, maxFrame)

  const onPoseSourceChange = (mode: PoseSourceMode) => {
    setPoseSourceMode(mode)
    if (mode === 'animation' && !primary.animationPoseModelId && poseModels.length > 0) {
      const first = poseModels[0]
      setAnimationPoseModel(first.id, first.clips[0]?.name ?? null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className={labelClass}>Pose source</span>
      <div className="flex flex-col gap-1 text-xs text-white/80">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="pose-source"
            checked={poseSourceMode === 'preset'}
            onChange={() => onPoseSourceChange('preset')}
          />
          Base pose
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="pose-source"
            checked={poseSourceMode === 'animation'}
            onChange={() => onPoseSourceChange('animation')}
          />
          Pose From Animation
        </label>
      </div>

      {poseSourceMode === 'preset' ? (
        <label className="flex flex-col gap-1">
          <span className={labelClass}>
            Base pose{selectedCount > 1 ? ` (${selectedCount} selected)` : ''}
          </span>
          <select
            className={selectClass}
            value={primary.basePoseId}
            onChange={(e) => setBasePoseId(e.target.value)}
          >
            {Object.keys(availablePoses).map((pose) => (
              <option key={pose} value={pose}>
                {pose}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>
              Animation model{selectedCount > 1 ? ` (${selectedCount} selected)` : ''}
            </span>
            <select
              className={selectClass}
              value={primary.animationPoseModelId}
              disabled={poseModels.length === 0}
              onChange={(e) => {
                const model = poseModels.find((m) => m.id === e.target.value)
                setAnimationPoseModel(model?.id ?? e.target.value, model?.clips[0]?.name ?? null)
              }}
            >
              {poseModels.length === 0 ? (
                <option value="">No pose models found</option>
              ) : (
                poseModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))
              )}
            </select>
          </label>

          {poseModels.length === 0 && (
            <p className="text-xs text-white/45">
              Add GLB files to <code className="text-white/60">poses/pose-models/</code>
            </p>
          )}

          {clips.length > 1 && (
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Clip</span>
              <select
                className={selectClass}
                value={activeClipName ?? ''}
                onChange={(e) => setAnimationClip(e.target.value || null)}
              >
                {clips.map((clip) => (
                  <option key={clip.name} value={clip.name}>
                    {clip.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className={labelClass}>
              Frame t: {frame} / {maxFrame}
            </span>
            <input
              className="w-full accent-sky-400"
              type="range"
              min={0}
              max={maxFrame}
              step={1}
              value={frame}
              disabled={!selectedPoseModel}
              onInput={(e) => setAnimationFrame(Number(e.currentTarget.value))}
              onChange={(e) => setAnimationFrame(Number(e.currentTarget.value))}
            />
          </label>
        </div>
      )}

      <span className="block min-h-4 text-xs text-amber-300/80">
        {adjustmentCount > 0 ? `${adjustmentCount} adjustment(s) on primary` : null}
      </span>
    </div>
  )
}
