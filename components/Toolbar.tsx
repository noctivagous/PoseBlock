'use client'

import { CHARACTER_OPTIONS, POSES } from '@/lib/poses'
import { useStore, type TransformMode } from '@/lib/store'

export function Toolbar() {
  const modelUrl = useStore((s) => s.modelUrl)
  const currentPose = useStore((s) => s.currentPose)
  const transformMode = useStore((s) => s.transformMode)
  const set = useStore((s) => s.set)

  const characterId =
    CHARACTER_OPTIONS.find((c) => c.url === modelUrl)?.id ?? 'xbot'

  return (
    <div className="fixed left-4 top-24 z-10 flex flex-col gap-2 rounded-lg bg-black/70 p-3 text-sm text-white backdrop-blur">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-white/60">Character</span>
        <select
          className="rounded bg-zinc-800 px-2 py-1.5 text-white"
          value={characterId}
          onChange={(e) => {
            const option = CHARACTER_OPTIONS.find((c) => c.id === e.target.value)
            if (option) set({ modelUrl: option.url })
          }}
        >
          {CHARACTER_OPTIONS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-white/60">Pose</span>
        <select
          className="rounded bg-zinc-800 px-2 py-1.5 text-white"
          value={currentPose}
          onChange={(e) => set({ currentPose: e.target.value })}
        >
          {Object.keys(POSES).map((pose) => (
            <option key={pose} value={pose}>
              {pose}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-white/60">Transform</span>
        <div className="flex gap-1">
          {(
            [
              ['translate', 'Move'],
              ['scale', 'Scale'],
            ] as [TransformMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => set({ transformMode: mode })}
              className={`flex-1 rounded px-2 py-1.5 ${
                transformMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-white/80 hover:bg-zinc-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-white/50">
          Drag the cyan box handles to move or scale.
        </p>
      </div>
    </div>
  )
}
