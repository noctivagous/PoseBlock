'use client'

import { useMemo } from 'react'
import {
  anchorToBoundsFrame,
  boundsFrameToAnchor,
  clampMannequinScale,
  maxFeetAnchorY,
  parseAspectRatio,
  patchBoundsFrame,
} from '@/lib/framing'
import { MAX_INSTANCES } from '@/lib/instances'
import { useStore } from '@/lib/store'

function NumField({
  label,
  value,
  step = 0.01,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  step?: number
  min?: number
  max?: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex flex-col gap-0.5 text-[10px]">
      <span className="text-white/50">{label}</span>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={Number(value.toFixed(4))}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded bg-zinc-800 px-2 py-1 text-xs text-white tabular-nums"
      />
    </label>
  )
}

export function InstanceMannequinPanel() {
  const instances = useStore((s) => s.instances)
  const selectedIds = useStore((s) => s.selectedIds)
  const frameWidth = useStore((s) => s.frameWidth)
  const frameHeight = useStore((s) => s.frameHeight)
  const addInstance = useStore((s) => s.addInstance)
  const removeInstance = useStore((s) => s.removeInstance)
  const updateInstance = useStore((s) => s.updateInstance)
  const selectInstance = useStore((s) => s.selectInstance)
  const clearSelection = useStore((s) => s.clearSelection)

  const primaryId = selectedIds[0] ?? null
  const primary = instances.find((i) => i.id === primaryId)
  const aspect = parseAspectRatio(frameWidth, frameHeight)

  const bounds = useMemo(() => {
    if (!primary) return null
    return anchorToBoundsFrame(primary, aspect)
  }, [primary, aspect])

  const canAdd = instances.length < MAX_INSTANCES

  const applyBoundsPatch = (patch: Parameters<typeof patchBoundsFrame>[1]) => {
    if (!primary || !bounds) return
    const nextBounds = patchBoundsFrame(bounds, patch, aspect)
    const anchor = boundsFrameToAnchor(nextBounds, aspect)
    updateInstance(primary.id, anchor)
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-black/40 p-3 text-sm">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => addInstance()}
          className="rounded bg-zinc-700 px-2 py-1 text-xs font-semibold text-white hover:bg-zinc-600 disabled:opacity-40"
        >
          Add mannequin
        </button>
        <span className="text-[10px] text-white/50">
          {instances.length}/{MAX_INSTANCES}
        </span>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between text-[10px] text-white/50">
          <span>
            {selectedIds.length} selected
            {selectedIds.length > 1 ? ' — pose/model edits apply to all' : ''}
          </span>
          <button type="button" onClick={clearSelection} className="underline hover:text-white/80">
            Clear
          </button>
        </div>
      )}

      <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto">
        {instances.map((inst, index) => {
          const selected = selectedIds.includes(inst.id)
          return (
            <li key={inst.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => selectInstance(inst.id, { shiftKey: e.shiftKey })}
                className={`flex-1 rounded px-2 py-1 text-left text-xs ${
                  selected
                    ? inst.id === primaryId
                      ? 'bg-amber-500/30 text-amber-100 ring-1 ring-amber-400/50'
                      : 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/40'
                    : 'bg-zinc-800/80 text-white/80 hover:bg-zinc-700'
                }`}
              >
                Mannequin {index + 1}
              </button>
              <button
                type="button"
                aria-label="Remove mannequin"
                onClick={() => removeInstance(inst.id)}
                className="rounded bg-red-900/60 px-2 py-1 text-xs text-red-100 hover:bg-red-800"
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>

      {instances.length === 0 && (
        <p className="text-xs text-white/45">Add a mannequin to begin blocking.</p>
      )}

      {primary && (
        <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-2">
          <p className="col-span-2 text-[10px] uppercase tracking-wide text-white/40">
            Feet anchor (primary)
          </p>
          <NumField
            label="X (0–1)"
            value={primary.x}
            min={0}
            max={1}
            onChange={(x) => updateInstance(primary.id, { x })}
          />
          <NumField
            label="Y (0–1+)"
            value={primary.y}
            min={0}
            max={maxFeetAnchorY(primary.scale)}
            onChange={(y) => updateInstance(primary.id, { y })}
          />
          <NumField
            label="Scale"
            value={primary.scale}
            min={0.1}
            max={20}
            step={0.05}
            onChange={(scale) =>
              updateInstance(primary.id, { scale: clampMannequinScale(scale) })
            }
          />
          <NumField
            label="Rotation °"
            value={primary.rotation}
            step={1}
            onChange={(rotation) => updateInstance(primary.id, { rotation })}
          />
        </div>
      )}

      {primary && bounds && (
        <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-2">
          <p className="col-span-2 text-[10px] uppercase tracking-wide text-white/40">
            Bounds insets
          </p>
          <NumField
            label="Inset left"
            value={bounds.insetLeft}
            onChange={(insetLeft) => applyBoundsPatch({ insetLeft })}
          />
          <NumField
            label="Inset right"
            value={bounds.insetRight}
            onChange={(insetRight) => applyBoundsPatch({ insetRight })}
          />
          <NumField
            label="Inset top"
            value={bounds.insetTop}
            onChange={(insetTop) => applyBoundsPatch({ insetTop })}
          />
          <NumField
            label="Inset bottom"
            value={bounds.insetBottom}
            onChange={(insetBottom) => applyBoundsPatch({ insetBottom })}
          />
          <NumField
            label="Width ÷ frame H"
            value={bounds.widthToFrameHeight}
            step={0.01}
            onChange={(widthToFrameHeight) => applyBoundsPatch({ widthToFrameHeight })}
          />
        </div>
      )}
    </div>
  )
}
