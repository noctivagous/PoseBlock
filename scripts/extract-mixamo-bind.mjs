#!/usr/bin/env node

import fs from 'fs/promises'
import path from 'path'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const ROOT = path.resolve(import.meta.dirname, '..')
const DEFAULT_SOURCE = path.join(ROOT, 'public/models/Y Bot.glb')
const OUT_PATH = path.join(ROOT, 'poses/mixamo-reference-bind.json')

function canonicalBoneName(name) {
  return name.replace(/^mixamorig[:_]?/i, '')
}

function getSkeleton(scene) {
  let skeleton = null
  scene.traverse((obj) => {
    if (!skeleton && obj.isSkinnedMesh && obj.skeleton) skeleton = obj.skeleton
  })
  return skeleton
}

async function loadGlb(glbPath) {
  const file = await fs.readFile(glbPath)
  const arrayBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
  const loader = new GLTFLoader()
  return new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, '', resolve, reject)
  })
}

async function main() {
  const sourceArg = process.argv[2]
  const sourcePath = sourceArg ? path.resolve(sourceArg) : DEFAULT_SOURCE
  const gltf = await loadGlb(sourcePath)
  const skeleton = getSkeleton(gltf.scene)
  if (!skeleton) throw new Error(`No skeleton in ${sourcePath}`)

  const bind = {}
  for (const bone of skeleton.bones) {
    bind[canonicalBoneName(bone.name)] = bone.quaternion.toArray().map((v) => Number(v.toFixed(7)))
  }

  const payload = {
    source: path.relative(ROOT, sourcePath),
    bind,
  }

  await fs.writeFile(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${Object.keys(bind).length} bones to ${path.relative(ROOT, OUT_PATH)}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
