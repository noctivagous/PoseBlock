'use client'

import { useStore } from '../lib/store'
import { PoseSourceControls } from './PoseSourceControls'

export function Toolbar() {
  const instances = useStore((s) => s.instances)
  const selectedIds = useStore((s) => s.selectedIds)
  const characterModels = useStore((s) => s.characterModels)
  const updateInstance = useStore((s) => s.updateInstance)

  const primaryId = selectedIds[0] ?? null
  const primary = instances.find((i) => i.id === primaryId)

  const characterId =
    characterModels.find((c) => c.url === primary?.modelUrl)?.id ??
    characterModels[0]?.id ??
    ''

  const selectedCount = selectedIds.length

  const setModelForSelected = (url: string) => {
    for (const id of selectedIds) {
      updateInstance(id, { modelUrl: url })
    }
  }

  if (!primary) {
    return (
      <div className="rounded-lg bg-black/40 p-3 text-xs text-white/50">
        Select a mannequin to edit character and pose.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-black/40 p-3 text-sm">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-white/60">
          Character{selectedCount > 1 ? ` (${selectedCount} selected)` : ''}
        </span>
        <select
          className="rounded bg-zinc-800 px-2 py-1.5 text-white"
          value={characterId}
          onChange={(e) => {
            const option = characterModels.find((c) => c.id === e.target.value)
            if (option) setModelForSelected(option.url)
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

      <PoseSourceControls />

      <p className="text-xs text-white/50">
        Click to select. Shift+click for multi-select. Drag to move; gizmos edit the primary
        selection.
      </p>
    </div>
  )
}
