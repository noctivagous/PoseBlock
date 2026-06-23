import { describe, expect, it } from 'vitest'
import { VIEW_HEIGHT } from '../../lib/sceneConstants'
import {
  anchorToBoundsFrame,
  anchorToWorldTransform,
  boundsFrameToAnchor,
  parseAspectRatio,
  worldTransformToAnchor,
} from '../../lib/framing'

describe('anchorAdapter round-trip', () => {
  const frame16x9 = { frameWidth: 1920, frameHeight: 1080 }
  const frame9x16 = { frameWidth: 1080, frameHeight: 1920 }

  it('round-trips feet anchor ↔ world at 16:9', () => {
    const anchor = { x: 0.5, y: 1, scale: 1, rotation: 0 }
    const world = anchorToWorldTransform({
      anchor,
      characterZ: 0,
      characterRotationX: 0,
      ...frame16x9,
    })
    const back = worldTransformToAnchor({ ...world, ...frame16x9 })
    expect(back.x).toBeCloseTo(anchor.x, 3)
    expect(back.y).toBeCloseTo(anchor.y, 3)
    expect(back.scale).toBeCloseTo(anchor.scale, 2)
    expect(back.rotation).toBeCloseTo(anchor.rotation, 1)
  })

  it('round-trips at 9:16', () => {
    const anchor = { x: 0.35, y: 0.92, scale: 1.2, rotation: 15 }
    const world = anchorToWorldTransform({
      anchor,
      characterZ: 0.2,
      characterRotationX: 5,
      ...frame9x16,
    })
    const back = worldTransformToAnchor({ ...world, ...frame9x16 })
    expect(back.x).toBeCloseTo(anchor.x, 2)
    expect(back.y).toBeCloseTo(anchor.y, 2)
    expect(back.scale).toBeCloseTo(anchor.scale, 2)
  })

  it('supports ECU feet below frame (y > 1)', () => {
    const anchor = { x: 0.5, y: 1.35, scale: 8, rotation: 0 }
    const world = anchorToWorldTransform({
      anchor,
      characterZ: 0,
      characterRotationX: 0,
      ...frame16x9,
    })
    expect(world.worldY).toBeLessThan(-VIEW_HEIGHT / 2)
    const back = worldTransformToAnchor({ ...world, ...frame16x9 })
    expect(back.y).toBeCloseTo(anchor.y, 2)
    expect(back.scale).toBeCloseTo(anchor.scale, 1)
  })
})

describe('bounds ↔ anchor', () => {
  it('round-trips bounds at 16:9', () => {
    const aspect = parseAspectRatio(1920, 1080)
    const anchor = { x: 0.5, y: 1, scale: 1 }
    const bounds = anchorToBoundsFrame(anchor, aspect)
    const back = boundsFrameToAnchor(bounds, aspect)
    expect(back.x).toBeCloseTo(anchor.x, 2)
    expect(back.y).toBeCloseTo(anchor.y, 2)
    expect(back.scale).toBeCloseTo(anchor.scale, 2)
  })
})
