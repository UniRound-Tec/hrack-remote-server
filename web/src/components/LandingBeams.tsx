'use client'

import { Mesh, Program, Renderer, Triangle } from 'ogl'
import { useEffect, useRef } from 'react'
import { useVisualPerformanceProfile } from '@/lib/use-visual-performance'
import { markVisualFrame } from '@/lib/visual-fps'

const vertex = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const fragment = `
precision highp float;

varying vec2 vUv;
uniform float uTime;

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

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 3; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    amplitude *= 0.5;
  }
  return value;
}

float beam(vec2 p, float side, float offset, float width, float phase) {
  float motion = fbm(vec2(p.y * 2.2 + phase, uTime * 0.18 + phase)) - 0.5;
  float wave = sin(uTime * 0.32 + phase + p.y * 3.2) * 0.035;
  float center = side * (0.93 - p.y * 0.78) + offset + motion * 0.13 + wave;
  float spread = width + (1.0 - p.y) * 0.11;
  float distanceToBeam = abs(p.x - center);
  float body = 1.0 - smoothstep(spread * 0.18, spread, distanceToBeam);
  float lowerFade = smoothstep(0.015, 0.13, p.y);
  float upperFade = 1.0 - smoothstep(0.84, 1.0, p.y);
  float sweep = 0.72 + 0.28 * sin(uTime * 0.46 + phase + p.y * 6.0);
  float texture = 0.62 + 0.38 * fbm(vec2(p.x * 2.0 + phase, p.y * 4.0 - uTime * 0.11));
  texture *= sweep;
  return body * lowerFade * upperFade * texture;
}

float seam(float x, float position, float width) {
  return exp(-pow((x - position) / width, 2.0));
}

void main() {
  vec2 p = vec2((vUv.x - 0.5) * 2.0, vUv.y);

  float beams = 0.0;
  beams += beam(p, -1.0, -0.13, 0.17, 0.4) * 0.30;
  beams += beam(p, -1.0,  0.03, 0.13, 2.7) * 0.52;
  beams += beam(p, -1.0,  0.17, 0.10, 5.1) * 0.22;
  beams += beam(p,  1.0,  0.13, 0.17, 1.3) * 0.30;
  beams += beam(p,  1.0, -0.03, 0.13, 3.8) * 0.52;
  beams += beam(p,  1.0, -0.17, 0.10, 6.4) * 0.22;

  float travel = 0.62 + 0.38 * sin(uTime * 0.92 - vUv.y * 12.0 + abs(p.x) * 3.0);
  beams *= travel;
  float pulse = 0.78 + 0.22 * sin(uTime * 0.68);

  float roamingGlow = exp(-pow((abs(p.x) - (0.47 + sin(uTime * 0.42) * 0.16)) / 0.17, 2.0));
  roamingGlow *= smoothstep(0.03, 0.14, vUv.y) * (1.0 - smoothstep(0.82, 1.0, vUv.y));

  float alpha = clamp(beams * 0.42 * pulse + roamingGlow * 0.075, 0.0, 0.36);
  gl_FragColor = vec4(vec3(1.0), alpha);
}
`

export function LandingBeams() {
  const sceneRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const { backgroundDpr, backgroundFps, constrained, reducedMotion } =
    useVisualPerformanceProfile()

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene || reducedMotion) return

    const target = { x: 0, y: 0, px: 50, py: 72 }
    const current = { x: 0, y: 0, px: 50, py: 72 }
    let frame = 0

    const handlePointerMove = (event: PointerEvent) => {
      const rect = scene.getBoundingClientRect()
      const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
      const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
      target.x = (x - 0.5) * 2
      target.y = (y - 0.5) * 2
      target.px = x * 100
      target.py = 8 + y * 84
      if (!frame) frame = requestAnimationFrame(animatePointer)
    }

    const animatePointer = () => {
      frame = 0
      current.x += (target.x - current.x) * 0.075
      current.y += (target.y - current.y) * 0.075
      current.px += (target.px - current.px) * 0.075
      current.py += (target.py - current.py) * 0.075

      const shiftX = current.x * 92
      const shiftY = current.y * 46
      scene.style.setProperty('--smoke-x', `${shiftX}px`)
      scene.style.setProperty('--smoke-y', `${shiftY}px`)
      scene.style.setProperty('--smoke-x-reverse', `${shiftX * -0.72}px`)
      scene.style.setProperty('--smoke-y-reverse', `${shiftY * -0.55}px`)
      scene.style.setProperty('--smoke-pointer-x', `${current.px}%`)
      scene.style.setProperty('--smoke-pointer-y', `${current.py}%`)

      const unsettled =
        Math.abs(target.x - current.x) > 0.002 ||
        Math.abs(target.y - current.y) > 0.002 ||
        Math.abs(target.px - current.px) > 0.04 ||
        Math.abs(target.py - current.py) > 0.04
      if (unsettled) frame = requestAnimationFrame(animatePointer)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', handlePointerMove)
    }
  }, [reducedMotion])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: false,
      dpr: backgroundDpr
    })
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)
    gl.canvas.style.display = 'block'
    gl.canvas.style.width = '100%'
    gl.canvas.style.height = '100%'

    const geometry = new Triangle(gl)
    const program = new Program(gl, {
      vertex,
      fragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } }
    })
    const mesh = new Mesh(gl, { geometry, program })

    const handleContextLost = (event: Event) => {
      event.preventDefault()
      host.classList.remove('is-ready')
      cancelAnimationFrame(frame)
    }
    gl.canvas.addEventListener('webglcontextlost', handleContextLost)

    const resize = () => {
      renderer.setSize(
        Math.max(host.clientWidth, 1),
        Math.max(host.clientHeight, 1)
      )
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()
    host.appendChild(gl.canvas)

    let frame = 0
    let lastRender = Number.NEGATIVE_INFINITY
    let intersecting = true
    let stopped = false
    const frameInterval = backgroundFps > 0 ? 1000 / backgroundFps : Infinity

    const draw = (now: number) => {
      program.uniforms.uTime.value = backgroundFps > 0 ? now * 0.001 : 0
      renderer.render({ scene: mesh })
      markVisualFrame('background')
      host.classList.add('is-ready')
    }

    const render = (now: number) => {
      frame = 0
      if (stopped || document.hidden || !intersecting) return
      if (now - lastRender >= frameInterval - 1) {
        draw(now)
        lastRender = now
      }
      frame = requestAnimationFrame(render)
    }

    const schedule = () => {
      if (
        stopped ||
        frame ||
        document.hidden ||
        !intersecting ||
        backgroundFps <= 0
      ) {
        return
      }
      frame = requestAnimationFrame(render)
    }

    const resume = () => {
      cancelAnimationFrame(frame)
      frame = 0
      if (document.hidden || !intersecting) return
      lastRender = Number.NEGATIVE_INFINITY
      draw(performance.now())
      schedule()
    }

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      intersecting = entry?.isIntersecting ?? true
      if (intersecting) resume()
      else {
        cancelAnimationFrame(frame)
        frame = 0
      }
    })
    intersectionObserver.observe(host)
    document.addEventListener('visibilitychange', resume)
    resume()

    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      intersectionObserver.disconnect()
      document.removeEventListener('visibilitychange', resume)
      gl.canvas.removeEventListener('webglcontextlost', handleContextLost)
      if (gl.canvas.parentElement === host) host.removeChild(gl.canvas)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [backgroundDpr, backgroundFps])

  return (
    <div
      ref={sceneRef}
      aria-hidden
      className={`landing-beams${constrained ? ' is-constrained' : ''}${reducedMotion ? ' is-reduced-motion' : ''}`}
    >
      <div ref={hostRef} className="landing-beams-canvas" />
      <div className="landing-smoke">
        <span />
        <span />
      </div>
    </div>
  )
}
