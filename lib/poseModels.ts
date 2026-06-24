export type PoseModelClip = {
  name: string
  duration: number
  frameCount: number
}

export type PoseModel = {
  id: string
  label: string
  url: string
  clips: PoseModelClip[]
}

export const ANIMATION_POSE_FPS = 30

const GLB_EXT_PATTERN = /\.glb$/i

export function isPoseModelFilename(filename: string): boolean {
  return GLB_EXT_PATTERN.test(filename)
}

/** Runtime pose sampling is GLB-only; FBX in pose-models/ must be converted offline. */
export function poseModelUrlFromRelativePath(relativePath: string): string {
  const segments = relativePath.split(/[/\\]/).map((segment) => encodeURIComponent(segment))
  return `/api/pose-models/file/${segments.join('/')}`
}

export function poseModelLabelFromRelativePath(relativePath: string): string {
  return relativePath.replace(GLB_EXT_PATTERN, '')
}

export function poseModelIdFromRelativePath(relativePath: string): string {
  return relativePath
    .replace(GLB_EXT_PATTERN, '')
    .toLowerCase()
    .replace(/[/\\]+/g, '-')
    .replace(/\s+/g, '-')
}

export function frameCountFromDuration(duration: number, fps = ANIMATION_POSE_FPS): number {
  if (!Number.isFinite(duration) || duration <= 0) return 1
  return Math.max(1, Math.floor(duration * fps) + 1)
}
