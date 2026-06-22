export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

export function compositeToDataURL(
  backdrop: HTMLImageElement,
  overlayCanvas: HTMLCanvasElement
): string {
  const canvas = document.createElement('canvas')
  canvas.width = backdrop.naturalWidth
  canvas.height = backdrop.naturalHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2D context')

  ctx.drawImage(backdrop, 0, 0, canvas.width, canvas.height)
  ctx.drawImage(overlayCanvas, 0, 0, canvas.width, canvas.height)

  return canvas.toDataURL('image/png')
}

export function downloadDataURL(dataURL: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataURL
  a.download = filename
  a.click()
}

type ExportHandler = () => Promise<string>

let exportHandler: ExportHandler | null = null

export function registerExportHandler(handler: ExportHandler) {
  exportHandler = handler
}

export function unregisterExportHandler() {
  exportHandler = null
}

export async function runCompositeExport(): Promise<string> {
  if (!exportHandler) {
    throw new Error('Scene not ready for export')
  }
  return exportHandler()
}
