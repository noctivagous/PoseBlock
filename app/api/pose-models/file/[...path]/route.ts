import { readFile } from 'fs/promises'
import path from 'path'

const POSE_MODELS_DIR = path.join(process.cwd(), 'poses', 'pose-models')

function resolveSafePath(segments: string[]): string | null {
  const resolved = path.resolve(POSE_MODELS_DIR, ...segments)
  if (!resolved.startsWith(POSE_MODELS_DIR)) return null
  if (!resolved.toLowerCase().endsWith('.glb')) return null
  return resolved
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await context.params
  const filePath = resolveSafePath(segments)
  if (!filePath) {
    return Response.json({ error: 'Invalid path' }, { status: 400 })
  }

  try {
    const data = await readFile(filePath)
    return new Response(data, {
      headers: {
        'Content-Type': 'model/gltf-binary',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }
    throw error
  }
}
