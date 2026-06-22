'use client'

import { useStore } from '@/lib/store'

type PreviewFrameProps = {
  children: React.ReactNode
}

export function PreviewFrame({ children }: PreviewFrameProps) {
  const backdropUrl = useStore((s) => s.backdropUrl)
  const frameWidth = useStore((s) => s.frameWidth)
  const frameHeight = useStore((s) => s.frameHeight)
  const set = useStore((s) => s.set)

  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-950 p-4">
      <div
        className="relative w-full max-h-[calc(100vh-2rem)] overflow-hidden rounded-sm shadow-2xl ring-1 ring-white/15"
        style={{ aspectRatio: `${frameWidth} / ${frameHeight}` }}
      >
        <img
          src={backdropUrl}
          alt="Video frame backdrop"
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget
            set({
              frameWidth: img.naturalWidth,
              frameHeight: img.naturalHeight,
            })
          }}
        />
        <div className="absolute inset-0">{children}</div>
      </div>
    </div>
  )
}
