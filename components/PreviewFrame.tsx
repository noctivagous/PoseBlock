'use client'

import { useStore } from '../lib/store'

type PreviewFrameProps = {
  children: React.ReactNode
  /** When set, overrides store backdrop (embed mode). */
  backdropUrl?: string
  className?: string
  /** Host app provides backdrop; render transparent canvas only. */
  embedMode?: boolean
  onFrameLoad?: (width: number, height: number) => void
}

export function PreviewFrame({
  children,
  backdropUrl: backdropUrlProp,
  className,
  embedMode = false,
  onFrameLoad,
}: PreviewFrameProps) {
  const storeBackdropUrl = useStore((s) => s.backdropUrl)
  const set = useStore((s) => s.set)
  const backdropUrl = backdropUrlProp ?? storeBackdropUrl

  if (embedMode) {
    return (
      <div className={className ?? 'relative h-full w-full'}>
        <div className="absolute inset-0">{children}</div>
      </div>
    )
  }

  return (
    <div
      className={
        className ??
        'flex h-full w-full items-center justify-center bg-zinc-950 p-3'
      }
    >
      <div className="relative aspect-video w-full max-h-full overflow-hidden rounded-sm shadow-2xl ring-1 ring-white/15">
        <img
          src={backdropUrl}
          alt="Video frame backdrop"
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget
            set({
              frameWidth: img.naturalWidth,
              frameHeight: img.naturalHeight,
            })
            onFrameLoad?.(img.naturalWidth, img.naturalHeight)
          }}
        />
        <div className="absolute inset-0">{children}</div>
      </div>
    </div>
  )
}
