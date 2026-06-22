import { create } from 'zustand'

export type TransformMode = 'translate' | 'scale'

export type StoreState = {
  modelUrl: string
  currentPose: string
  backdropUrl: string
  frameWidth: number
  frameHeight: number
  characterX: number
  characterY: number
  characterScale: number
  transformMode: TransformMode
  characterError: string | null
  set: (partial: Partial<StoreState>) => void
}

export const useStore = create<StoreState>((set) => ({
  modelUrl: '/models/xbot_mixamo.glb',
  currentPose: 'pointing_right',
  backdropUrl: '/default_backdrop.jpg',
  frameWidth: 16,
  frameHeight: 9,
  characterX: 0,
  characterY: 0,
  characterScale: 1,
  transformMode: 'translate',
  characterError: null,
  set: (partial) => set(partial),
}))
