import { readdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import type { Pose } from '@/lib/poses'

function isQuaternionTuple(value: unknown): value is [number, number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  )
}

function isPose(value: unknown): value is Pose {
  if (!value || typeof value !== 'object') return false
  return Object.values(value).every(isQuaternionTuple)
}

function presetNameFromFilename(filename: string): string {
  return filename.replace(/\.json$/i, '')
}

function isValidPresetName(name: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(name)
}

async function loadFilePresets(posesDir: string): Promise<Record<string, Pose>> {
  const presets: Record<string, Pose> = {}

  let files: string[] = []
  try {
    files = await readdir(posesDir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return presets
    }
    throw error
  }

  for (const file of files.filter((f) => f.toLowerCase().endsWith('.json')).sort()) {
    try {
      const fullPath = path.join(posesDir, file)
      const raw = await readFile(fullPath, 'utf8')
      const parsed: unknown = JSON.parse(raw)

      if (isPose(parsed)) {
        presets[presetNameFromFilename(file)] = parsed
        continue
      }

      if (
        parsed &&
        typeof parsed === 'object' &&
        'pose' in parsed &&
        isPose((parsed as { pose: unknown }).pose)
      ) {
        presets[presetNameFromFilename(file)] = (parsed as { pose: Pose }).pose
      }
    } catch {
      // Skip malformed JSON files so one bad file doesn't block loading.
    }
  }

  return presets
}

export async function GET() {
  const posesDir = path.join(process.cwd(), 'poses')
  const presets: Record<string, Pose> = await loadFilePresets(posesDir)

  return Response.json(presets)
}

export async function POST(request: Request) {
  const body: unknown = await request.json()
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { name, pose } = body as { name?: unknown; pose?: unknown }
  if (typeof name !== 'string' || !isValidPresetName(name)) {
    return Response.json({ error: 'Invalid pose name' }, { status: 400 })
  }
  if (!isPose(pose)) {
    return Response.json({ error: 'Invalid pose data' }, { status: 400 })
  }

  const posesDir = path.join(process.cwd(), 'poses')
  const filePath = path.join(posesDir, `${name}.json`)
  const payload = {
    pose,
    sourceBase: (body as { sourceBase?: string }).sourceBase ?? null,
    adjustments: (body as { adjustments?: unknown }).adjustments ?? [],
    savedAt: new Date().toISOString(),
  }

  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  return Response.json({ ok: true, name })
}

