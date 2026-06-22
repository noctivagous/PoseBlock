'use client'

import { useControls } from 'leva'
import { useStore } from '@/lib/store'

/** Leva panel — backdrop image only. Character/pose use Toolbar (HTML selects). */
export function Controls() {
  const set = useStore((s) => s.set)

  useControls('PoseBlock', {
    backdrop: {
      image: undefined,
      onChange: (v: string | undefined) => {
        if (v) set({ backdropUrl: v })
      },
    },
  })

  return null
}
