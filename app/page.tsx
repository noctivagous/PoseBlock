'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef } from 'react'
import { ExportButton } from '@/components/ExportButton'
import { PoseAdjustToolbar } from '@/components/PoseAdjustToolbar'
import { PreviewFrame } from '@/components/PreviewFrame'
import { Toolbar } from '@/components/Toolbar'
import type { CharacterModel } from '@/lib/characterModels'
import { getAllPosePresets } from '@/lib/posePresets'
import type { Pose } from '@/lib/poses'
import { useStore } from '@/lib/store'

const Scene = dynamic(() => import('@/components/Scene').then((m) => m.Scene), {
  ssr: false,
})

const Controls = dynamic(
  () => import('@/components/Controls').then((m) => m.Controls),
  { ssr: false }
)

export default function Home() {
  const set = useStore((s) => s.set)
  const characterError = useStore((s) => s.characterError)
  const characterModels = useStore((s) => s.characterModels)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/models')
      .then((res) => res.json())
      .then((models: CharacterModel[]) => {
        set({ characterModels: models })
        const currentUrl = useStore.getState().modelUrl
        if (models.length > 0 && !models.some((m) => m.url === currentUrl)) {
          set({ modelUrl: models[0].url })
        }
      })
      .catch(() => {
        set({ characterError: 'Could not load models from /public/models' })
      })
  }, [set])

  useEffect(() => {
    fetch('/api/poses')
      .then((res) => res.json())
      .then((presets: Record<string, Pose>) => {
        set({ posePresets: presets })
        const available = getAllPosePresets(presets)
        const current = useStore.getState().basePoseId
        if (!available[current]) {
          const first = Object.keys(available)[0]
          set({ basePoseId: first ?? 't_pose' })
        }
      })
      .catch(() => {
        // Keep built-in fallback presets when external JSON presets fail to load.
      })
  }, [set])

  const handleBackdropUpload = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file)
      set({ backdropUrl: url })
    },
    [set]
  )

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleBackdropUpload(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file?.type.startsWith('image/')) handleBackdropUpload(file)
  }

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-zinc-950"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <PreviewFrame>
        <Scene />
      </PreviewFrame>

      <Controls />
      <Toolbar />
      <PoseAdjustToolbar />
      <ExportButton />

      <div className="pointer-events-none fixed left-4 top-4 z-10 flex flex-col gap-2">
        <h1 className="text-lg font-semibold text-white drop-shadow">PoseBlock</h1>
        <p className="max-w-xs text-xs text-white/70 drop-shadow">
          Drag the mannequin to move it. Use the bounding-box arrows to rotate or
          change depth, and drag the corner handle to resize.
          Export composites the original bitmap with the 3D overlay at full resolution.
        </p>
      </div>

      <div className="fixed bottom-4 left-4 z-10">
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
          className="rounded bg-white/10 px-3 py-2 text-sm text-white backdrop-blur hover:bg-white/20"
        >
          Upload frame
        </button>
      </div>

      {characterError && (
        <div className="fixed inset-x-0 top-1/2 z-20 mx-auto max-w-md -translate-y-1/2 rounded-lg bg-red-900/90 p-4 text-center text-white">
          <p className="font-medium">{characterError}</p>
          <button
            type="button"
            className="mt-2 text-sm underline"
            onClick={() => {
              const first = characterModels[0]
              set({
                characterError: null,
                modelUrl: first?.url ?? '',
              })
            }}
          >
            Retry
          </button>
        </div>
      )}
    </main>
  )
}
