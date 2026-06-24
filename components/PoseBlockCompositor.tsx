'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'
import { PreviewFrame } from '../components/PreviewFrame'
import {
  createDefaultControlRig,
  createDefaultIkBlend,
  createDefaultPinnedWorldPos,
  createDefaultPins,
  type CharacterInstance,
} from '../lib/instances'
import { useStore } from '../lib/store'
import type { PoseBlockCompositorProps, PoseBlockInstance } from '../types'

const Scene = dynamic(() => import('../components/Scene').then((m) => m.Scene), {
  ssr: false,
})

function toStoreInstance(ext: PoseBlockInstance): CharacterInstance {
  return {
    id: ext.id,
    modelUrl: ext.modelUrl,
    basePoseId: ext.basePoseId,
    poseAdjustments: ext.poseAdjustments ?? [],
    poseAdjustmentPast: [],
    poseAdjustmentFuture: [],
    x: ext.x,
    y: ext.y,
    scale: ext.scale,
    rotation: ext.characterRotationY ?? ext.rotation,
    characterZ: ext.characterZ ?? 0,
    characterRotationX: ext.characterRotationX ?? 0,
    characterRotationY: ext.characterRotationY ?? ext.rotation,
    controlRig: ext.controlRig ?? createDefaultControlRig(),
    pins: ext.pins ?? createDefaultPins(),
    pinnedWorldPos: ext.pinnedWorldPos ?? createDefaultPinnedWorldPos(),
    ikBlend: ext.ikBlend ?? createDefaultIkBlend(),
  }
}

function instancesSignature(instances: PoseBlockInstance[] | undefined): string {
  if (!instances || instances.length === 0) return '[]'
  return JSON.stringify(
    instances.map((inst) => ({
      id: inst.id,
      modelUrl: inst.modelUrl,
      basePoseId: inst.basePoseId,
      poseAdjustments: inst.poseAdjustments ?? [],
      x: inst.x,
      y: inst.y,
      scale: inst.scale,
      rotation: inst.rotation,
      characterZ: inst.characterZ ?? 0,
      characterRotationX: inst.characterRotationX ?? 0,
      characterRotationY: inst.characterRotationY ?? inst.rotation,
      controlRig: inst.controlRig ?? createDefaultControlRig(),
      pins: inst.pins ?? createDefaultPins(),
      pinnedWorldPos: inst.pinnedWorldPos ?? createDefaultPinnedWorldPos(),
      ikBlend: inst.ikBlend ?? createDefaultIkBlend(),
    })),
  )
}

function selectedIdsSignature(ids: string[] | undefined): string {
  if (!ids || ids.length === 0) return '[]'
  return ids.join(',')
}

export function PoseBlockCompositor({
  className,
  backdropUrl,
  frameWidth,
  frameHeight,
  instances,
  selectedIds,
  onSelect,
  onInstanceChange,
  enableExport = true,
  embedMode = false,
  children,
}: PoseBlockCompositorProps) {
  const set = useStore((s) => s.set)
  const hasSyncedInstancesRef = useRef(false)
  const hasSyncedSelectionRef = useRef(false)
  const lastInstancesSigRef = useRef<string>('')
  const lastSelectedSigRef = useRef<string>('')

  // Register outward callbacks in the store so CharacterManipulator
  // can call them on user interaction without causing render loops.
  useEffect(() => {
    set({
      onInstanceChange: onInstanceChange ?? null,
      onSelect: onSelect ?? null,
    })
  }, [onInstanceChange, onSelect, set])

  useEffect(() => {
    if (backdropUrl !== undefined) {
      set({ backdropUrl })
    }
  }, [backdropUrl, set])

  useEffect(() => {
    if (frameWidth !== undefined && frameHeight !== undefined) {
      set({ frameWidth, frameHeight })
    }
  }, [frameWidth, frameHeight, set])

  // Sync external instances INTO the store only when they meaningfully change.
  useEffect(() => {
    if (instances === undefined) return
    const sig = instancesSignature(instances)
    if (sig === lastInstancesSigRef.current) return
    lastInstancesSigRef.current = sig

    const mapped = instances.map(toStoreInstance)
    if (mapped.length > 0) hasSyncedInstancesRef.current = true
    if (mapped.length === 0 && !hasSyncedInstancesRef.current) return
    set({ instances: mapped })
  }, [instances, set])

  // Sync external selectedIds INTO the store only when they meaningfully change.
  useEffect(() => {
    if (selectedIds === undefined) return
    const sig = selectedIdsSignature(selectedIds)
    if (sig === lastSelectedSigRef.current) return
    lastSelectedSigRef.current = sig

    if (selectedIds.length > 0) hasSyncedSelectionRef.current = true
    if (selectedIds.length === 0 && !hasSyncedSelectionRef.current) return
    set({ selectedIds })
  }, [selectedIds, set])

  return (
    <div className={className ?? 'relative h-full min-h-0 w-full'}>
      <PreviewFrame backdropUrl={backdropUrl} embedMode={embedMode}>
        <Scene enableExport={enableExport} />
      </PreviewFrame>
      {children}
    </div>
  )
}
