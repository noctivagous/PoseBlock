import { readdir } from 'fs/promises'
import path from 'path'
import {
  modelIdFromFilename,
  modelUrlFromFilename,
  type CharacterModel,
} from '@/lib/characterModels'

export async function GET() {
  const modelsDir = path.join(process.cwd(), 'public', 'models')
  const files = await readdir(modelsDir)

  const models: CharacterModel[] = files
    .filter((file) => file.toLowerCase().endsWith('.glb'))
    .sort()
    .map((filename) => ({
      id: modelIdFromFilename(filename),
      label: filename.replace(/\.glb$/i, ''),
      url: modelUrlFromFilename(filename),
    }))

  return Response.json(models)
}
