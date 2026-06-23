export type CharacterModel = {
  id: string
  label: string
  url: string
}

const MODEL_EXT_PATTERN = /\.(glb|fbx)$/i

export function isFbxModelUrl(url: string): boolean {
  return url.toLowerCase().endsWith('.fbx')
}

export function isModelFilename(filename: string): boolean {
  return MODEL_EXT_PATTERN.test(filename)
}

export function modelUrlFromFilename(relativePath: string): string {
  const segments = relativePath.split(/[/\\]/).map((segment) => encodeURIComponent(segment))
  return `/models/${segments.join('/')}`
}

export function modelLabelFromRelativePath(relativePath: string): string {
  return relativePath.replace(MODEL_EXT_PATTERN, '')
}

export function modelIdFromFilename(relativePath: string): string {
  return relativePath
    .replace(MODEL_EXT_PATTERN, '')
    .toLowerCase()
    .replace(/[/\\]+/g, '-')
    .replace(/\s+/g, '-')
}
