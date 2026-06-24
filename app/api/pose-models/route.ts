import { readdir, readFile } from 'fs/promises'
import path from 'path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  ANIMATION_POSE_FPS,
  frameCountFromDuration,
  isPoseModelFilename,
  poseModelIdFromRelativePath,
  poseModelLabelFromRelativePath,
  poseModelUrlFromRelativePath,
  type PoseModel,
  type PoseModelClip,
} from '../../../lib/poseModels'

const POSE_MODELS_DIR = path.join(process.cwd(), 'poses', 'pose-models')

async function collectGlbFiles(dir: string, baseDir: string): Promise<string[]> {
  let entries: import('fs').Dirent[] = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }

  const files: string[] = []
  for (const entry of entries) {
    const name = String(entry.name)
    const fullPath = path.join(dir, name)
    if (entry.isDirectory()) {
      files.push(...(await collectGlbFiles(fullPath, baseDir)))
    } else if (isPoseModelFilename(name)) {
      files.push(path.relative(baseDir, fullPath))
    }
  }
  return files
}

async function probeClips(glbPath: string): Promise<PoseModelClip[]> {
  const file = await readFile(glbPath)
  const arrayBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
  const loader = new GLTFLoader()
  const gltf = await new Promise<{ animations: THREE.AnimationClip[] }>((resolve, reject) => {
    loader.parse(arrayBuffer, '', resolve, reject)
  })

  return gltf.animations.map((clip) => ({
    name: clip.name,
    duration: clip.duration,
    frameCount: frameCountFromDuration(clip.duration, ANIMATION_POSE_FPS),
  }))
}

export async function GET() {
  const files = await collectGlbFiles(POSE_MODELS_DIR, POSE_MODELS_DIR)
  const models: PoseModel[] = []

  for (const relativePath of files.sort((a, b) => a.localeCompare(b))) {
    const fullPath = path.join(POSE_MODELS_DIR, relativePath)
    let clips: PoseModelClip[] = []
    try {
      clips = await probeClips(fullPath)
    } catch {
      clips = []
    }

    models.push({
      id: poseModelIdFromRelativePath(relativePath),
      label: poseModelLabelFromRelativePath(relativePath),
      url: poseModelUrlFromRelativePath(relativePath),
      clips,
    })
  }

  return Response.json(models)
}
