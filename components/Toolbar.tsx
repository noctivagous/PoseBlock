'use client'

import { getAllPosePresets } from '@/lib/posePresets'
import { useStore, type InteractionMode } from '@/lib/store'
import { useMemo } from 'react'

export function Toolbar() {
  const modelUrl = useStore((s) => s.modelUrl)
  const characterModels = useStore((s) => s.characterModels)
  const posePresets = useStore((s) => s.posePresets)
  const basePoseId = useStore((s) => s.basePoseId)
  const poseAdjustments = useStore((s) => s.poseAdjustments)
  const interactionMode = useStore((s) => s.interactionMode)
  const set = useStore((s) => s.set)
  const setBasePoseId = useStore((s) => s.setBasePoseId)
  const availablePoses = useMemo(() => getAllPosePresets(posePresets), [posePresets])

  const characterId =
    characterModels.find((c) => c.url === modelUrl)?.id ??
    characterModels[0]?.id ??
    ''

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-black/40 p-3 text-sm">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-white/60">Character</span>
        <select
          className="rounded bg-zinc-800 px-2 py-1.5 text-white"
          value={characterId}
          onChange={(e) => {
            const option = characterModels.find((c) => c.id === e.target.value)
            if (option) set({ modelUrl: option.url })
          }}
          disabled={characterModels.length === 0}
        >
          {characterModels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-white/60">Base pose</span>
        <select
          className="rounded bg-zinc-800 px-2 py-1.5 text-white"
          value={basePoseId}
          onChange={(e) => setBasePoseId(e.target.value)}
        >
          {Object.keys(availablePoses).map((pose) => (
            <option key={pose} value={pose}>
              {pose}
            </option>
          ))}
        </select>
        <span className="block min-h-4 text-xs text-amber-300/80">
          {poseAdjustments.length > 0
            ? `${poseAdjustments.length} adjustment(s) applied`
            : null}
        </span>
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-white/60">Interaction</span>
        <div className="flex gap-1">
          {(
            [
              ['transform', 'Transform'],
              ['pose', 'Pose edit'],
            ] as [InteractionMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() =>
                set({
                  interactionMode: mode,
                  ...(mode === 'transform' ? { selectedBodyPart: null } : {}),
                })
              }
              className={`flex-1 rounded px-2 py-1.5 ${
                interactionMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-white/80 hover:bg-zinc-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-white/50">
          {interactionMode === 'transform'
            ? 'Drag to move. Use box arrows to rotate or change depth; drag the corner to resize.'
            : 'Click body parts on the mannequin to adjust pose.'}
        </p>
      </div>
    </div>
  )
}
