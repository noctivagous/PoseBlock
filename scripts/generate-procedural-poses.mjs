#!/usr/bin/env node

/**
 * Bake procedural pose presets to poses/generated/*.json
 * Run: npm run generate:poses
 */

import { spawnSync } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

const outDir = path.join(process.cwd(), 'poses', 'generated')

const ts = `
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { getProceduralPoses } from '../lib/proceduralPoses.ts'

const outDir = path.join(process.cwd(), 'poses', 'generated')
mkdirSync(outDir, { recursive: true })

const presets = getProceduralPoses()
for (const [name, pose] of Object.entries(presets)) {
  const file = path.join(outDir, \`\${name}.json\`)
  writeFileSync(file, JSON.stringify({ pose }, null, 2) + '\\n', 'utf8')
}
console.log(\`Wrote \${Object.keys(presets).length} procedural pose files to poses/generated/\`)
`

await fs.mkdir(outDir, { recursive: true })
const tmp = path.join(process.cwd(), '.tmp-generate-poses.ts')
await fs.writeFile(tmp, ts, 'utf8')

const result = spawnSync('npx', ['--yes', 'tsx', tmp], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: process.env,
})

await fs.unlink(tmp).catch(() => {})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}
