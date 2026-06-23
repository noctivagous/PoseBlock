#!/usr/bin/env node

import { execFileSync } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const ROOT = path.resolve(import.meta.dirname, '..')
const POSES_DIR = path.join(ROOT, 'poses')
const POSE_MODELS_DIR = path.join(POSES_DIR, 'pose-models')
const FBX2GLB = process.env.POSEBLOCK_FBX2GLB ?? path.join(ROOT, 'tools/bin/fbx2glb')

const DEFAULT_MAX_SAMPLES = 5
const DEFAULT_INTERVAL = 0.5
const DEFAULT_EPSILON = 0.5

function slugify(name) {
  return name
    .replace(/\.(fbx|glb)$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function timeSlug(seconds) {
  return `t${Math.round(seconds * 1000).toString().padStart(4, '0')}`
}

function parseArgs(argv) {
  const opts = {
    interval: DEFAULT_INTERVAL,
    maxSamples: DEFAULT_MAX_SAMPLES,
    epsilon: DEFAULT_EPSILON,
    clean: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help') opts.help = true
    else if (arg === '--interval') opts.interval = Number(argv[++i])
    else if (arg === '--max-samples') opts.maxSamples = Number(argv[++i])
    else if (arg === '--epsilon') opts.epsilon = Number(argv[++i])
    else if (arg === '--clean') opts.clean = true
    else throw new Error(`Unknown argument: ${arg}`)
  }

  if (!Number.isFinite(opts.interval) || opts.interval <= 0) {
    throw new Error('--interval must be a positive number')
  }
  if (!Number.isFinite(opts.maxSamples) || opts.maxSamples <= 0) {
    throw new Error('--max-samples must be a positive number')
  }
  if (!Number.isFinite(opts.epsilon) || opts.epsilon < 0) {
    throw new Error('--epsilon must be >= 0')
  }

  opts.maxSamples = Math.floor(opts.maxSamples)
  return opts
}

function printUsage() {
  console.log(`Usage:
  node scripts/extract-poseModels.mjs [options]

Options:
  --interval <sec>     Sample interval in seconds (default: ${DEFAULT_INTERVAL})
  --max-samples <n>    Maximum samples per model (default: ${DEFAULT_MAX_SAMPLES})
  --epsilon <deg>      Min rotation change in degrees (default: ${DEFAULT_EPSILON})
  --clean              Remove prior generated posemodel*.json before writing
  --help               Show this help

Source models are read from poses/pose-models/ (gitignored).
Place poseModel*.fbx files there, then run this script.`)
}

function canonicalBoneName(name) {
  return name.replace(/^mixamorig[:_]?/i, '')
}

function roundQuat(q) {
  return [
    Number(q.x.toFixed(7)),
    Number(q.y.toFixed(7)),
    Number(q.z.toFixed(7)),
    Number(q.w.toFixed(7)),
  ]
}

function angleDegFromIdentity(q) {
  const w = Math.min(1, Math.max(-1, Math.abs(q.w)))
  return (2 * Math.acos(w) * 180) / Math.PI
}

function getSkeleton(scene) {
  let skeleton = null
  scene.traverse((obj) => {
    if (!skeleton && obj.isSkinnedMesh && obj.skeleton) {
      skeleton = obj.skeleton
    }
  })
  return skeleton
}

async function loadGlb(glbPath) {
  const file = await fs.readFile(glbPath)
  const arrayBuffer = file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength
  )
  const loader = new GLTFLoader()
  return new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, '', resolve, reject)
  })
}

function computeSampleTimes(duration, interval, maxSamples) {
  if (!Number.isFinite(duration) || duration <= 0) return [0]

  const candidates = []
  for (let t = 0; t <= duration + 1e-6; t += interval) {
    candidates.push(Number(t.toFixed(6)))
  }
  if (candidates.length === 0 || Math.abs(candidates[candidates.length - 1] - duration) > 1e-3) {
    candidates.push(duration)
  }
  if (candidates.length <= maxSamples) return candidates

  const times = []
  for (let i = 0; i < maxSamples; i += 1) {
    const idx = Math.round((i / (maxSamples - 1)) * (candidates.length - 1))
    times.push(candidates[idx])
  }
  return [...new Set(times)]
}

async function ensureGlb(modelPath) {
  const ext = path.extname(modelPath).toLowerCase()
  if (ext === '.glb') return modelPath

  const glbPath = modelPath.replace(/\.fbx$/i, '.glb')
  try {
    const [srcStat, glbStat] = await Promise.all([
      fs.stat(modelPath),
      fs.stat(glbPath),
    ])
    if (glbStat.mtimeMs >= srcStat.mtimeMs) return glbPath
  } catch {
    // GLB missing or unreadable — convert below.
  }

  await fs.access(FBX2GLB)
  const outBase = glbPath.replace(/\.glb$/i, '')
  execFileSync(FBX2GLB, ['-b', '-i', modelPath, '-o', outBase], {
    stdio: 'inherit',
  })
  return glbPath
}

async function extractFromModel(modelPath, options) {
  const glbPath = await ensureGlb(modelPath)
  const probe = await loadGlb(glbPath)
  const firstClip = probe.animations[0] ?? null
  const clipName = firstClip?.name ?? null
  const duration = firstClip?.duration ?? 0
  const sampleTimes = computeSampleTimes(
    duration,
    options.interval,
    options.maxSamples
  )
  const baseSlug = slugify(path.basename(modelPath))
  const outputs = []

  for (const sampleTime of sampleTimes) {
    const gltf = await loadGlb(glbPath)
    const scene = gltf.scene
    scene.updateMatrixWorld(true)

    const skeleton = getSkeleton(scene)
    if (!skeleton) throw new Error(`No skeleton in ${modelPath}`)

    const bindByCanonical = new Map()
    for (const bone of skeleton.bones) {
      const key = canonicalBoneName(bone.name)
      if (!bindByCanonical.has(key)) {
        bindByCanonical.set(key, bone.quaternion.clone())
      }
    }

    const sampledClip = clipName
      ? gltf.animations.find((anim) => anim.name === clipName) ?? null
      : null
    if (sampledClip) {
      const mixer = new THREE.AnimationMixer(scene)
      const action = mixer.clipAction(sampledClip)
      action.play()
      mixer.setTime(Math.max(0, Math.min(sampleTime, sampledClip.duration)))
    }
    scene.updateMatrixWorld(true)

    const pose = {}
    for (const bone of skeleton.bones) {
      const key = canonicalBoneName(bone.name)
      const bindQ = bindByCanonical.get(key)
      if (!bindQ) continue

      const delta = bindQ.clone().invert().multiply(bone.quaternion).normalize()
      if (angleDegFromIdentity(delta) > options.epsilon) pose[key] = roundQuat(delta)
    }

    const outName = `${baseSlug}-${timeSlug(sampleTime)}.json`
    const outPath = path.join(POSES_DIR, outName)
    const payload = {
      source: path.relative(ROOT, glbPath),
      clip: sampledClip?.name ?? null,
      availableClips: probe.animations.map((c) => c.name),
      sampleTime,
      pose,
    }
    await fs.writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    outputs.push(outPath)
  }

  return { modelPath, glbPath, duration, sampleTimes, outputs }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printUsage()
    return
  }

  await fs.mkdir(POSE_MODELS_DIR, { recursive: true })

  let modelEntries = []
  try {
    modelEntries = await fs.readdir(POSE_MODELS_DIR)
  } catch {
    // pose-models/ may not exist yet on fresh clone.
  }

  const models = modelEntries
    .filter((name) => /^posemodel/i.test(name) && /\.fbx$/i.test(name))
    .sort()

  if (options.clean) {
    const poseEntries = await fs.readdir(POSES_DIR)
    const generated = poseEntries.filter((name) => /^posemodel.*-t\d+\.json$/i.test(name))
    await Promise.all(generated.map((name) => fs.unlink(path.join(POSES_DIR, name))))
    if (generated.length > 0) {
      console.log(`Removed ${generated.length} existing generated pose file(s)`)
    }
  }

  if (models.length === 0) {
    console.log('No poseModel*.fbx files found in poses/pose-models/')
    return
  }

  console.log(`Found ${models.length} poseModel file(s)\n`)
  const results = []

  for (const name of models) {
    const modelPath = path.join(POSE_MODELS_DIR, name)
    console.log(`Processing ${name}...`)
    try {
      const result = await extractFromModel(modelPath, options)
      results.push(result)
      console.log(
        `  duration=${result.duration.toFixed(2)}s → ${result.sampleTimes.length} pose(s): ${result.outputs.map((p) => path.basename(p)).join(', ')}`
      )
    } catch (err) {
      console.error(`  FAILED: ${err instanceof Error ? err.message : String(err)}`)
    }
    console.log()
  }

  const totalPoses = results.reduce((n, r) => n + r.outputs.length, 0)
  console.log(`Done. Wrote ${totalPoses} pose file(s) from ${results.length} model(s).`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
