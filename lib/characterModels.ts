export type CharacterModel = {
  id: string
  label: string
  url: string
}

export function modelUrlFromFilename(filename: string): string {
  return `/models/${encodeURIComponent(filename)}`
}

export function modelIdFromFilename(filename: string): string {
  return filename
    .replace(/\.glb$/i, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
}
