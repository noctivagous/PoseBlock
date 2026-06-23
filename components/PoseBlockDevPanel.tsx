'use client'

import { useCallback, useRef } from 'react'
import { ExportButton } from '@/components/ExportButton'
import { InstanceMannequinPanel } from '@/components/InstanceMannequinPanel'
import { PoseAdjustToolbar } from '@/components/PoseAdjustToolbar'
import { Toolbar } from '@/components/Toolbar'
import { useStore } from '@/lib/store'

/** Standalone dev panel — mirrors VideoGen right-panel layout (Phase 3). */
export function PoseBlockDevPanel() {
  const set = useStore((s) => s.set)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleBackdropUpload = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file)
      set({ backdropUrl: url })
    },
    [set],
  )

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleBackdropUpload(file)
  }

  return (
    <aside className="flex w-96 shrink-0 flex-col gap-3 overflow-y-auto border-l border-white/10 bg-zinc-900/80 p-4 text-white">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">PoseBlock</h1>
        <p className="text-xs text-white/60">
          Drag the mannequin to move it. Use bounding-box controls to rotate,
          change depth, or scale. Export composites the backdrop with the 3D overlay.
        </p>
      </div>

      <InstanceMannequinPanel />
      <Toolbar />
      <PoseAdjustToolbar />

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded bg-zinc-800 px-3 py-2 text-sm text-white hover:bg-zinc-700"
        >
          Upload frame
        </button>
        <ExportButton />
      </div>
    </aside>
  )
}
