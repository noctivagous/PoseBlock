'use client'

import dynamic from 'next/dynamic'
import { useCallback, useRef } from 'react'
import { ExportButton } from '@/components/ExportButton'
import { PreviewFrame } from '@/components/PreviewFrame'
import { Toolbar } from '@/components/Toolbar'
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      <ExportButton />

      <div className="pointer-events-none fixed left-4 top-4 z-10 flex flex-col gap-2">
        <h1 className="text-lg font-semibold text-white drop-shadow">PoseBlock</h1>
        <p className="max-w-xs text-xs text-white/70 drop-shadow">
          Drag the cyan bounding box handles to move or scale the mannequin.
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
            onClick={() =>
              set({ characterError: null, modelUrl: '/models/xbot_mixamo.glb' })
            }
          >
            Retry with X-Bot
          </button>
        </div>
      )}
    </main>
  )
}
