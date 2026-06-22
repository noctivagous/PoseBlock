'use client'

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import {
  compositeToDataURL,
  loadImage,
  registerExportHandler,
  unregisterExportHandler,
} from '@/lib/exportComposite'
import { useStore } from '@/lib/store'

export function ExportRegistrar() {
  const gl = useThree((s) => s.gl)
  const setSize = useThree((s) => s.setSize)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    registerExportHandler(async () => {
      const { backdropUrl } = useStore.getState()
      const backdrop = await loadImage(backdropUrl)
      const exportW = backdrop.naturalWidth
      const exportH = backdrop.naturalHeight
      const prevW = size.width
      const prevH = size.height

      setSize(exportW, exportH)
      invalidate()

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })

      const dataURL = compositeToDataURL(backdrop, gl.domElement)

      setSize(prevW, prevH)
      invalidate()

      return dataURL
    })

    return () => unregisterExportHandler()
  }, [gl, setSize, size.width, size.height, invalidate])

  return null
}
