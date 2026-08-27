'use client'

import { MeshTransmissionMaterial, useFBO } from '@react-three/drei'
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import * as THREE from 'three'

type ButtonBounds = {
  height: number
  left: number
  top: number
  width: number
}

const backdropVertex = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const backdropFragment = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    float time = uTime * 0.32;

    float haze = noise(vec2(uv.x * 7.0 - time, uv.y * 4.0 + time * 0.35));
    float ribbon = exp(-pow((uv.y - 0.5) - sin(uv.x * 17.0 + time * 2.2) * 0.15, 2.0) * 42.0);
    float sweep = exp(-pow(fract(uv.x * 2.4 - time * 0.11) - 0.5, 2.0) * 30.0);
    float seam = exp(-pow(fract(uv.x * 4.0 + time * 0.025) - 0.5, 2.0) * 135.0);
    float centerGlow = exp(-dot(p * vec2(0.18, 1.0), p * vec2(0.18, 1.0)) * 1.6);
    float ember = exp(-dot((uv - vec2(0.72 + sin(time) * 0.08, 0.43)) * vec2(2.7, 5.0),
                           (uv - vec2(0.72 + sin(time) * 0.08, 0.43)) * vec2(2.7, 5.0)) * 8.0);

    vec3 color = vec3(0.012, 0.014, 0.016);
    color += vec3(0.18, 0.20, 0.22) * centerGlow;
    color += vec3(0.34, 0.38, 0.41) * ribbon * (0.28 + haze * 0.55);
    color += vec3(0.23, 0.27, 0.30) * sweep * (0.22 + centerGlow * 0.55);
    color += vec3(0.52, 0.57, 0.61) * seam * (0.08 + haze * 0.16);
    color += vec3(0.95, 0.16, 0.045) * ember * 0.42;

    gl_FragColor = vec4(color, 1.0);
  }
`

function RefractedBackdrop({
  materialRef,
  reducedMotion
}: {
  materialRef: React.RefObject<THREE.ShaderMaterial | null>
  reducedMotion: boolean
}) {
  const { size, viewport } = useThree()
  const uniforms = useMemo(
    () => ({
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 }
    }),
    []
  )

  useFrame(({ clock }) => {
    const material = materialRef.current
    if (!material) return

    material.uniforms.uResolution.value.set(size.width, size.height)
    material.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
  }, -2)

  return (
    <mesh position={[0, 0, -4]} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry />
      <shaderMaterial
        ref={materialRef}
        fragmentShader={backdropFragment}
        uniforms={uniforms}
        vertexShader={backdropVertex}
      />
    </mesh>
  )
}

function GlassPill({
  active,
  bounds,
  buffer,
  canvasHeight,
  canvasWidth,
  index,
  reducedMotion
}: {
  active: boolean
  bounds: ButtonBounds
  buffer: THREE.Texture
  canvasHeight: number
  canvasWidth: number
  index: number
  reducedMotion: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const hover = useRef(0)
  const geometry = useMemo(() => {
    const radius = bounds.height / 2
    const length = Math.max(bounds.width - bounds.height, 0.01)
    const nextGeometry = new THREE.CapsuleGeometry(radius, length, 16, 48)
    nextGeometry.rotateZ(Math.PI / 2)
    return nextGeometry
  }, [bounds.height, bounds.width])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(({ clock }, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    hover.current = THREE.MathUtils.damp(
      hover.current,
      active ? 1 : 0,
      8,
      delta
    )
    mesh.scale.z = 0.22 + hover.current * 0.045
    mesh.rotation.x = reducedMotion
      ? 0
      : Math.sin(clock.elapsedTime * 0.38 + index * 0.9) * 0.012
  })

  const x = bounds.left + bounds.width / 2 - canvasWidth / 2
  const y = canvasHeight / 2 - bounds.top - bounds.height / 2

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[x, y, 4]}
      scale={[1, 1, 0.22]}
    >
      <MeshTransmissionMaterial
        anisotropicBlur={0.12}
        attenuationColor="#dce7ec"
        attenuationDistance={180}
        buffer={buffer}
        chromaticAberration={active ? 0.12 : 0.075}
        color={active ? '#ffffff' : '#e9eef1'}
        distortion={active ? 0.22 : 0.14}
        distortionScale={0.38}
        ior={1.16}
        opacity={0.96}
        roughness={0.055}
        samples={6}
        temporalDistortion={reducedMotion ? 0 : 0.075}
        thickness={18}
        transmission={1}
        transparent
      />
    </mesh>
  )
}

function GlassScene({
  activeIndex,
  bounds,
  onRendered,
  reducedMotion
}: {
  activeIndex: number | null
  bounds: ButtonBounds[]
  onRendered: () => void
  reducedMotion: boolean
}) {
  const buffer = useFBO()
  const bufferScene = useMemo(() => new THREE.Scene(), [])
  const backdropMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const didRenderRef = useRef(false)
  const savedClearColor = useMemo(() => new THREE.Color(), [])
  const { size } = useThree()

  useFrame(({ camera, gl }) => {
    const previousTarget = gl.getRenderTarget()
    const previousAlpha = gl.getClearAlpha()
    gl.getClearColor(savedClearColor)

    gl.setRenderTarget(buffer)
    gl.setClearColor(0x000000, 1)
    gl.clear(true, true, true)
    gl.render(bufferScene, camera)
    gl.setRenderTarget(previousTarget)
    gl.setClearColor(savedClearColor, previousAlpha)

    if (bounds.length === 3 && !didRenderRef.current) {
      didRenderRef.current = true
      onRendered()
    }
  }, -1)

  return (
    <>
      {createPortal(
        <RefractedBackdrop
          materialRef={backdropMaterialRef}
          reducedMotion={reducedMotion}
        />,
        bufferScene
      )}
      <ambientLight intensity={0.7} />
      <directionalLight intensity={2.2} position={[-180, 120, 220]} />
      {bounds.map((buttonBounds, index) => (
        <GlassPill
          active={activeIndex === index}
          bounds={buttonBounds}
          buffer={buffer.texture}
          canvasHeight={size.height}
          canvasWidth={size.width}
          index={index}
          key={`${index}-${buttonBounds.width}-${buttonBounds.height}`}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  )
}

function sameBounds(a: ButtonBounds[], b: ButtonBounds[]) {
  return (
    a.length === b.length &&
    a.every((item, index) => {
      const other = b[index]
      return (
        other &&
        Math.abs(item.height - other.height) < 0.25 &&
        Math.abs(item.left - other.left) < 0.25 &&
        Math.abs(item.top - other.top) < 0.25 &&
        Math.abs(item.width - other.width) < 0.25
      )
    })
  )
}

export function LandingFluidGlass() {
  const layerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [bounds, setBounds] = useState<ButtonBounds[]>([])
  const [reducedMotion, setReducedMotion] = useState(false)
  const [rendered, setRendered] = useState(false)
  const handleRendered = useCallback(() => setRendered(true), [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useLayoutEffect(() => {
    const layer = layerRef.current
    const parent = layer?.parentElement
    if (!layer || !parent) return

    const buttons = Array.from(
      parent.querySelectorAll<HTMLAnchorElement>('.landing-action')
    )

    const measure = () => {
      const layerRect = layer.getBoundingClientRect()
      const nextBounds = buttons.map(button => {
        const rect = button.getBoundingClientRect()
        return {
          height: rect.height,
          left: rect.left - layerRect.left,
          top: rect.top - layerRect.top,
          width: rect.width
        }
      })
      setBounds(current => (sameBounds(current, nextBounds) ? current : nextBounds))
    }

    let cancelled = false
    const observer = new ResizeObserver(measure)
    observer.observe(layer)
    observer.observe(parent)
    buttons.forEach(button => observer.observe(button))

    const cleanups = buttons.map((button, index) => {
      const activate = () => setActiveIndex(index)
      const deactivate = () => setActiveIndex(current => (current === index ? null : current))
      button.addEventListener('pointerenter', activate)
      button.addEventListener('pointerleave', deactivate)
      button.addEventListener('focus', activate)
      button.addEventListener('blur', deactivate)
      return () => {
        button.removeEventListener('pointerenter', activate)
        button.removeEventListener('pointerleave', deactivate)
        button.removeEventListener('focus', activate)
        button.removeEventListener('blur', deactivate)
      }
    })

    measure()
    const frame = requestAnimationFrame(measure)
    void document.fonts?.ready.then(() => {
      if (!cancelled) measure()
    })
    window.addEventListener('resize', measure, { passive: true })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      cleanups.forEach(cleanup => cleanup())
      window.removeEventListener('resize', measure)
    }
  }, [])

  return (
    <div
      ref={layerRef}
      aria-hidden
      className={`landing-fluid-glass${rendered && bounds.length === 3 ? ' is-rendered' : ''}`}
    >
      <Canvas
        camera={{ position: [0, 0, 100], zoom: 1 }}
        dpr={[1, 1.5]}
        fallback={null}
        frameloop={reducedMotion ? 'demand' : 'always'}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        orthographic
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
          gl.domElement.addEventListener('webglcontextlost', () => {
            setRendered(false)
          })
        }}
      >
        <GlassScene
          activeIndex={activeIndex}
          bounds={bounds}
          onRendered={handleRendered}
          reducedMotion={reducedMotion}
        />
      </Canvas>
    </div>
  )
}
