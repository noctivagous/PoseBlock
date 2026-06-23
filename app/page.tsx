'use client'

import { useCallback } from 'react'
import { PoseBlockCompositor } from '@/components/PoseBlockCompositor'
import { PoseBlockDevPanel } from '@/components/PoseBlockDevPanel'
import { usePoseBlockBootstrap } from '@/lib/usePoseBlockBootstrap'
import { useStore } from '@/lib/store'

export default function Home() {
  usePoseBlockBootstrap()

  const characterError = useStore((s) => s.characterError)
  const characterModels = useStore((s) => s.characterModels)
  const set = useStore((s) => s.set)

  const handleBackdropUpload = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file)
      set({ backdropUrl: url })
    },
    [set],
  )

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file?.type.startsWith('image/')) handleBackdropUpload(file)
  }

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-zinc-950">
      <div
        className="relative min-w-0 flex-1"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <PoseBlockCompositor className="h-full w-full" />

        {characterError && (
          <div className="absolute inset-x-4 top-1/2 z-20 mx-auto max-w-md -translate-y-1/2 rounded-lg bg-red-900/90 p-4 text-center text-white">
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
      </div>

      <PoseBlockDevPanel />
    </main>
  )
}
