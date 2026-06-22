'use client'

import {
  downloadDataURL,
  runCompositeExport,
} from '@/lib/exportComposite'

export function ExportButton() {
  const handleExport = async () => {
    try {
      const dataURL = await runCompositeExport()
      downloadDataURL(dataURL, 'pose_blocking.png')
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed — is the scene loaded?')
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-blue-700"
    >
      Export for inpainting
    </button>
  )
}
