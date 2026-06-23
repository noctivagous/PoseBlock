import { readdir } from 'fs/promises'
import path from 'path'
import {
  isModelFilename,
  modelIdFromFilename,
  modelLabelFromRelativePath,
  modelUrlFromFilename,
  type CharacterModel,
} from '../../../lib/characterModels'

async function collectModelFiles(dir: string, baseDir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectModelFiles(fullPath, baseDir)))
    } else if (isModelFilename(entry.name)) {
      files.push(path.relative(baseDir, fullPath))
    }
  }

  return files
}

export async function GET() {
  const modelsDir = path.join(process.cwd(), 'public', 'models')
  const files = await collectModelFiles(modelsDir, modelsDir)

  const models: CharacterModel[] = files
    .sort((a, b) => a.localeCompare(b))
    .map((relativePath) => ({
      id: modelIdFromFilename(relativePath),
      label: modelLabelFromRelativePath(relativePath),
      url: modelUrlFromFilename(relativePath),
    }))

  return Response.json(models)
}
