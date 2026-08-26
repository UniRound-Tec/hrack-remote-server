'use client'

import { Mesh, Program, Renderer, Triangle } from 'ogl'
import { useEffect, useRef } from 'react'

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
  for (int i = 0; i < 4; i++) {
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
  float upperFade = 1.0 - smoothstep(0.50, 0.73, p.y);
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
  roamingGlow *= smoothstep(0.07, 0.18, vUv.y) * (1.0 - smoothstep(0.43, 0.60, vUv.y));

  float alpha = clamp(beams * 0.42 * pulse + roamingGlow * 0.075, 0.0, 0.36);
  gl_FragColor = vec4(vec3(1.0), alpha);
}
`

export function LandingBeams() {
  const sceneRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

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
      target.py = 58 + y * 34
    }

    const animatePointer = () => {
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
      frame = requestAnimationFrame(animatePointer)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    frame = requestAnimationFrame(animatePointer)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', handlePointerMove)
    }
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: false,
      dpr: Math.min(window.devicePixelRatio || 1, 1.5)
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
      renderer.setSize(host.clientWidth, host.clientHeight)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()
    host.appendChild(gl.canvas)

    let frame = 0
    const render = (now: number) => {
      program.uniforms.uTime.value = now * 0.001
      renderer.render({ scene: mesh })
      host.classList.add('is-ready')
      if (!document.hidden) {
        frame = requestAnimationFrame(render)
      }
    }

    const resume = () => {
      cancelAnimationFrame(frame)
      render(performance.now())
    }
    document.addEventListener('visibilitychange', resume)
    resume()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', resume)
      gl.canvas.removeEventListener('webglcontextlost', handleContextLost)
      if (gl.canvas.parentElement === host) host.removeChild(gl.canvas)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  return (
    <div ref={sceneRef} aria-hidden className="landing-beams">
      <div ref={hostRef} className="landing-beams-canvas" />
      <div className="landing-smoke">
        <span />
        <span />
      </div>
      <div className="landing-architecture">
        <div className="landing-architecture-zones">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  )
}
