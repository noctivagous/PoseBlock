'use client'

import { Canvas, useThree } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import { Suspense, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { VIEW_HEIGHT } from '../lib/sceneConstants'
import { CharacterManipulatorLayer } from './CharacterManipulator'
import { ExportRegistrar } from './ExportRegistrar'

type SceneProps = {
  enableExport?: boolean
}

function FrameCamera() {
  const camRef = useRef<THREE.OrthographicCamera>(null)
  const size = useThree((s) => s.size)

  useLayoutEffect(() => {
    const cam = camRef.current
    if (!cam) return

    const aspect = size.width / size.height || 16 / 9
    cam.left = (-VIEW_HEIGHT * aspect) / 2
    cam.right = (VIEW_HEIGHT * aspect) / 2
    cam.top = VIEW_HEIGHT / 2
    cam.bottom = -VIEW_HEIGHT / 2
    cam.near = 0.1
    cam.far = 100
    cam.position.set(0, 0, 10)
    cam.lookAt(0, 0, 0)
    cam.updateProjectionMatrix()
  }, [size.width, size.height])

  return (
    <OrthographicCamera ref={camRef} makeDefault near={0.1} far={100} position={[0, 0, 10]} />
  )
}

export function Scene({ enableExport = true }: SceneProps) {
  return (
    <Canvas
      className="h-full w-full"
      gl={{ alpha: true, preserveDrawingBuffer: true, antialias: true }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      style={{ background: 'transparent' }}
    >
      <FrameCamera />
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 4, 5]} intensity={1.2} />
      <Suspense fallback={null}>
        <CharacterManipulatorLayer />
      </Suspense>
      {enableExport && <ExportRegistrar />}
    </Canvas>
  )
}
