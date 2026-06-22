#!/usr/bin/env node

import fs from 'fs/promises'
import path from 'path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

function printUsage() {
  console.log(`Usage:
  node scripts/extract-pose.mjs --input <file.glb> [options]

Options:
  --clip <name>        Animation clip name (default: first clip)
  --time <seconds>     Sample time in seconds (default: 0)
  --frame <index>      Frame index to sample (overrides --time)
  --fps <number>       FPS for --frame conversion (default: 30)
  --out <file.json>    Output file path (default: stdout only)
  --all                Include unchanged bones (default: changed-only)
  --epsilon <deg>      Min rotation change in degrees (default: 0.5)
  --help               Show this help

Example:
  node scripts/extract-pose.mjs \\
    --input "public/models/Y Bot.glb" \\
    --clip "Idle" \\
    --frame 12 \\
    --fps 30 \\
    --out "poses/idle_frame12.json"
`)
}

function parseArgs(argv) {
  const opts = {
    fps: 30,
    time: 0,
    all: false,
    epsilon: 0.5,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help') opts.help = true
    else if (arg === '--input') opts.input = argv[++i]
    else if (arg === '--clip') opts.clip = argv[++i]
    else if (arg === '--time') opts.time = Number(argv[++i])
    else if (arg === '--frame') opts.frame = Number(argv[++i])
    else if (arg === '--fps') opts.fps = Number(argv[++i])
    else if (arg === '--out') opts.out = argv[++i]
    else if (arg === '--all') opts.all = true
    else if (arg === '--epsilon') opts.epsilon = Number(argv[++i])
    else throw new Error(`Unknown argument: ${arg}`)
  }

  return opts
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

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help || !opts.input) {
    printUsage()
    process.exit(opts.help ? 0 : 1)
  }

  const inputPath = path.resolve(process.cwd(), opts.input)
  const gltf = await loadGlb(inputPath)
  const scene = gltf.scene
  scene.updateMatrixWorld(true)

  const skeleton = getSkeleton(scene)
  if (!skeleton) throw new Error('No skeleton found in input model.')

  const bindByCanonical = new Map()
  for (const bone of skeleton.bones) {
    const key = canonicalBoneName(bone.name)
    if (!bindByCanonical.has(key)) {
      bindByCanonical.set(key, bone.quaternion.clone())
    }
  }

  const clipNames = gltf.animations.map((clip) => clip.name)
  let sampledClip = null
  let sampledTime = Number.isFinite(opts.time) ? opts.time : 0

  if (gltf.animations.length > 0) {
    sampledClip = opts.clip
      ? gltf.animations.find((clip) => clip.name === opts.clip)
      : gltf.animations[0]

    if (!sampledClip) {
      throw new Error(
        `Clip "${opts.clip}" not found. Available clips: ${clipNames.join(', ')}`
      )
    }

    if (Number.isFinite(opts.frame)) sampledTime = opts.frame / opts.fps
    sampledTime = Math.max(0, Math.min(sampledTime, sampledClip.duration))

    const mixer = new THREE.AnimationMixer(scene)
    const action = mixer.clipAction(sampledClip)
    action.play()
    mixer.setTime(sampledTime)
    scene.updateMatrixWorld(true)
  }

  const pose = {}
  for (const bone of skeleton.bones) {
    const key = canonicalBoneName(bone.name)
    const bindQ = bindByCanonical.get(key)
    if (!bindQ) continue

    const delta = bindQ.clone().invert().multiply(bone.quaternion).normalize()
    const changed = angleDegFromIdentity(delta) > opts.epsilon
    if (opts.all || changed) pose[key] = roundQuat(delta)
  }

  const payload = {
    source: path.relative(process.cwd(), inputPath),
    clip: sampledClip?.name ?? null,
    availableClips: clipNames,
    sampleTime: sampledTime,
    pose,
  }

  const text = JSON.stringify(payload, null, 2)
  if (opts.out) {
    const outPath = path.resolve(process.cwd(), opts.out)
    await fs.mkdir(path.dirname(outPath), { recursive: true })
    await fs.writeFile(outPath, `${text}\n`, 'utf8')
    console.log(`Wrote pose JSON: ${path.relative(process.cwd(), outPath)}`)
  } else {
    console.log(text)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})

