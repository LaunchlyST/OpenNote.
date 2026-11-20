/**
 * RippleDistortion — a React port of the Solid Bits component (OGL / WebGL).
 * The wave and composite shaders are kept as in the original. Additions for
 * Desknoty: `source` may be a canvas, `ambient` adds a slow flow (uTime) and
 * autonomous ripples so it moves without a pointer, rendering pauses while the
 * element is off screen, and without WebGL the source is shown as a still.
 */
import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { Renderer, Program, Mesh, Geometry, Triangle, Texture, RenderTarget } from 'ogl'

const MAX_WAVES = 100
const QUALITY_SCALE: Record<string, number> = { low: 0.4, medium: 0.7, high: 1 }
const START_SCALE = 1.5
const LIFE_CONSTANT = Math.log(500)

const waveVertex = `
precision highp float;
attribute vec2 position;
attribute vec2 uv;
attribute vec2 iOffset;
attribute vec2 iScale;
attribute float iOpacity;
varying vec2 vUv;
varying float vOpacity;
void main() {
  vUv = uv;
  vOpacity = iOpacity;
  gl_Position = vec4(iOffset + position * iScale, 0.0, 1.0);
}
`

const waveFragment = `
precision highp float;
varying vec2 vUv;
varying float vOpacity;
uniform float uRings;
const float PI = 3.141592653589793;
const float EDGE = 0.006737947;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = dot(p, p);
  if (r > 1.0) discard;
  float brush = (exp(-r * 5.0) - EDGE) / (1.0 - EDGE);
  brush *= 0.55 + 0.45 * cos(sqrt(r) * PI * 2.0 * uRings);
  gl_FragColor = vec4(vec3(brush * vOpacity * vOpacity), 1.0);
}
`

const screenVertex = `
precision highp float;
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

// Original composite shader, plus uFlow/uTime: a slow liquid drift of the
// source coordinates so the artwork keeps moving on its own.
const compositeFragment = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform sampler2D uDisplacement;
uniform vec2 uResolution;
uniform vec2 uTextureSize;
uniform vec2 uTexel;
uniform vec3 uTint;
uniform vec3 uHighlight;
uniform float uStrength;
uniform float uSwirl;
uniform float uDispersion;
uniform float uGlint;
uniform float uTintAmount;
uniform float uGrayscale;
uniform float uTime;
uniform float uFlow;
const float TAU = 6.283185307179586;

vec2 coverUV(vec2 uv) {
  vec2 safe = max(uTextureSize, vec2(1.0));
  vec2 s = uResolution / safe;
  vec2 scaledSize = safe * max(s.x, s.y);
  vec2 offset = (uResolution - scaledSize) * 0.5;
  return (uv * uResolution - offset) / scaledSize;
}

void main() {
  float amount = texture2D(uDisplacement, vUv).r;
  vec2 base = coverUV(vUv);
  if (uFlow > 0.0) {
    float t = uTime;
    base += uFlow * vec2(
      sin(base.y * 3.1 + t * 0.21) + 0.5 * sin(base.x * 5.3 - t * 0.17),
      cos(base.x * 2.7 - t * 0.19) + 0.5 * cos(base.y * 4.1 + t * 0.13)
    );
    base = 0.5 + (base - 0.5) * (1.0 - uFlow * 2.4);
  }
  float theta = amount * uSwirl * TAU;
  vec2 dir = vec2(sin(theta), cos(theta));
  vec2 push = dir * amount * uStrength;
  vec3 color;
  if (uDispersion > 0.001) {
    float split = uDispersion * 0.25;
    color.r = texture2D(uTexture, base + push * (1.0 + split)).r;
    color.g = texture2D(uTexture, base + push).g;
    color.b = texture2D(uTexture, base + push * (1.0 - split)).b;
  } else {
    color = texture2D(uTexture, base + push).rgb;
  }
  if (uGrayscale > 0.001) {
    color = mix(color, vec3(dot(color, vec3(0.2126, 0.7152, 0.0722))), uGrayscale);
  }
  if (uTintAmount > 0.001) {
    color = mix(color, color * uTint * 1.9, clamp(amount * 1.6, 0.0, 1.0) * uTintAmount);
  }
  if (uGlint > 0.001) {
    float ex = texture2D(uDisplacement, vUv + vec2(uTexel.x, 0.0)).r - texture2D(uDisplacement, vUv - vec2(uTexel.x, 0.0)).r;
    float ey = texture2D(uDisplacement, vUv + vec2(0.0, uTexel.y)).r - texture2D(uDisplacement, vUv - vec2(0.0, uTexel.y)).r;
    vec3 normal = normalize(vec3(-ex * 26.0, -ey * 26.0, 1.0));
    vec3 light = normalize(vec3(-0.35, 0.55, 1.0));
    float raw = pow(max(dot(normal, light), 0.0), 22.0);
    float flatSpec = pow(max(light.z, 0.0), 22.0);
    color += uHighlight * clamp((raw - flatSpec) / max(1.0 - flatSpec, 0.0001), 0.0, 1.0) * uGlint;
  }
  gl_FragColor = vec4(color, 1.0);
}
`

type Quality = 'low' | 'medium' | 'high'

/** The original component's default photo. */
export const DEFAULT_RIPPLE_SRC =
  'https://images.unsplash.com/photo-1782977389500-dd7adad33ebe?q=80&w=3416&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'

export interface RippleDistortionProps {
  /** An image URL, or a canvas to use as the texture. */
  source: string | HTMLCanvasElement
  brushSize?: number
  strength?: number
  swirl?: number
  rings?: number
  spread?: number
  fade?: number
  spacing?: number
  dispersion?: number
  glint?: number
  tint?: string
  tintAmount?: number
  grayscale?: boolean
  highlightColor?: string
  quality?: Quality
  /** Slow liquid drift of the artwork (0 = off). */
  flow?: number
  /** Drop a soft ripple every this many ms on its own (0 = off). */
  ambientEvery?: number
  className?: string
  style?: CSSProperties
}

const hexToRGB = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return [1, 1, 1]
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export default function RippleDistortion(props: RippleDistortionProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  // Latest props for the render loop, without re-creating the GL context.
  const live = useRef(props)
  live.current = props

  const { source, quality = 'low' } = props
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const fallback = () => {
      const url = typeof source === 'string' ? source : source.toDataURL('image/jpeg', 0.85)
      mount.style.backgroundImage = `url(${url})`
      mount.style.backgroundSize = 'cover'
      mount.style.backgroundPosition = 'center'
    }

    let renderer: Renderer
    try {
      renderer = new Renderer({ alpha: false, antialias: false, dpr: Math.min(window.devicePixelRatio || 1, 2) })
      if (!renderer.gl) throw new Error('no webgl')
    } catch {
      fallback()
      return
    }
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 1)
    const canvas = gl.canvas as HTMLCanvasElement
    canvas.style.cssText = 'display:block;width:100%;height:100%'
    mount.appendChild(canvas)

    const p0 = live.current
    const imageTexture = new Texture(gl, { generateMipmaps: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR, wrapS: gl.MIRRORED_REPEAT, wrapT: gl.MIRRORED_REPEAT })
    let disposed = false
    const compositeUniforms = {
      uTexture: { value: imageTexture },
      uDisplacement: { value: null as unknown as Texture },
      uResolution: { value: [1, 1] },
      uTextureSize: { value: [1, 1] },
      uTexel: { value: [1, 1] },
      uTint: { value: hexToRGB(p0.tint ?? '#6ec9f7') },
      uHighlight: { value: hexToRGB(p0.highlightColor ?? '#ffffff') },
      uStrength: { value: p0.strength ?? 0.2 },
      uSwirl: { value: p0.swirl ?? 1 },
      uDispersion: { value: p0.dispersion ?? 0 },
      uGlint: { value: p0.glint ?? 0 },
      uTintAmount: { value: p0.tintAmount ?? 0.1 },
      uGrayscale: { value: (p0.grayscale ?? true) ? 1 : 0 },
      uTime: { value: 0 },
      uFlow: { value: reduceMotion ? 0 : p0.flow ?? 0 },
    }
    const setImage = (img: HTMLImageElement | HTMLCanvasElement, w: number, h: number) => {
      imageTexture.image = img
      compositeUniforms.uTextureSize.value = [w || 1, h || 1]
    }
    if (typeof source === 'string') {
      const image = new window.Image()
      image.crossOrigin = 'anonymous'
      image.decoding = 'async'
      image.onload = () => { if (!disposed) setImage(image, image.naturalWidth, image.naturalHeight) }
      image.src = source
    } else {
      setImage(source, source.width, source.height)
    }

    const offsets = new Float32Array(MAX_WAVES * 2)
    const scales = new Float32Array(MAX_WAVES * 2)
    const opacities = new Float32Array(MAX_WAVES)
    const waves = Array.from({ length: MAX_WAVES }, () => ({ x: 0, y: 0, scale: START_SCALE, target: START_SCALE, size: 1, opacity: 0 }))
    let current = 0

    const geometry = new Geometry(gl, {
      position: { size: 2, data: new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]) },
      uv: { size: 2, data: new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]) },
      iOffset: { instanced: 1, size: 2, data: offsets },
      iScale: { instanced: 1, size: 2, data: scales },
      iOpacity: { instanced: 1, size: 1, data: opacities },
    })
    const waveUniforms = { uRings: { value: p0.rings ?? 4 } }
    const waveProgram = new Program(gl, { vertex: waveVertex, fragment: waveFragment, uniforms: waveUniforms, transparent: true, depthTest: false, depthWrite: false, cullFace: false })
    waveProgram.setBlendFunc(gl.ONE, gl.ONE)
    const waveMesh = new Mesh(gl, { geometry, program: waveProgram, frustumCulled: false })
    const displacementTarget = new RenderTarget(gl, { width: 2, height: 2, depth: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE })
    compositeUniforms.uDisplacement.value = displacementTarget.texture
    const compositeProgram = new Program(gl, { vertex: screenVertex, fragment: compositeFragment, uniforms: compositeUniforms, depthTest: false, depthWrite: false })
    const triangle = new Triangle(gl)
    const compositeMesh = new Mesh(gl, { geometry: triangle, program: compositeProgram })

    let width = 1
    let height = 1
    let resizePending = false
    const resize = () => {
      width = Math.max(1, mount.clientWidth)
      height = Math.max(1, mount.clientHeight)
      renderer.setSize(width, height)
      compositeUniforms.uResolution.value = [width, height]
      const scale = QUALITY_SCALE[quality] || QUALITY_SCALE.high
      const fieldW = Math.max(2, Math.round(width * scale))
      const fieldH = Math.max(2, Math.round(height * scale))
      displacementTarget.setSize(fieldW, fieldH)
      compositeUniforms.uTexel.value = [1 / fieldW, 1 / fieldH]
    }
    const ro = new ResizeObserver(() => { resizePending = true })
    ro.observe(mount)
    resize()

    const setNewWave = (x: number, y: number, power: number, size?: number) => {
      const cfg = live.current
      const wave = waves[current]
      current = (current + 1) % MAX_WAVES
      wave.x = x
      wave.y = y
      wave.scale = START_SCALE * power
      wave.target = START_SCALE * Math.max(1, cfg.spread ?? 5) * power
      wave.size = Math.max(1, size ?? cfg.brushSize ?? 150)
      wave.opacity = 1
    }

    // Pointer ripples (desktop mice only; touch is left to the carousel swipe).
    let previousX = 0
    let previousY = 0
    const onMove = (event: PointerEvent) => {
      if (reduceMotion || event.pointerType !== 'mouse') return
      const rect = mount.getBoundingClientRect()
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return
      const x = event.clientX - rect.left
      const y = rect.height - (event.clientY - rect.top)
      const step = Math.max(1, live.current.spacing ?? 15)
      if (Math.abs(x - previousX) > step || Math.abs(y - previousY) > step) {
        setNewWave(x, y, 1)
        previousX = x
        previousY = y
      }
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    // Only draw while visible.
    let visible = false
    let raf = 0
    let previousTime = 0
    let nextAmbient = 0
    const io = new IntersectionObserver(([e]) => {
      const was = visible
      visible = e.isIntersecting
      if (visible && !was) { previousTime = 0; raf = requestAnimationFrame(loop) }
      if (!visible) cancelAnimationFrame(raf)
    })
    io.observe(mount)

    const loop = (now: number) => {
      if (disposed || !visible) return
      if (resizePending) { resizePending = false; resize() }
      raf = requestAnimationFrame(loop)
      const delta = previousTime ? Math.min(0.05, (now - previousTime) / 1000) : 0
      previousTime = now
      const cfg = live.current
      compositeUniforms.uTime.value += reduceMotion ? 0 : delta
      const every = cfg.ambientEvery ?? 0
      if (!reduceMotion && every > 0 && now >= nextAmbient) {
        nextAmbient = now + every * (0.7 + Math.random() * 0.6)
        setNewWave(width * (0.1 + Math.random() * 0.8), height * (0.1 + Math.random() * 0.8), 1.2, (cfg.brushSize ?? 150) * 1.6)
      }
      const growth = reduceMotion ? 0 : 1 - Math.exp(-delta * 1.09)
      const decay = reduceMotion ? 1 : Math.exp((-delta * LIFE_CONSTANT) / Math.max(0.15, cfg.fade ?? 3))
      for (let i = 0; i < MAX_WAVES; i += 1) {
        const wave = waves[i]
        if (wave.opacity <= 0) { opacities[i] = 0; continue }
        wave.opacity *= decay
        wave.scale += (wave.target - wave.scale) * growth
        if (wave.opacity < 0.002) { wave.opacity = 0; opacities[i] = 0; continue }
        const half = (wave.scale * wave.size) / 2
        offsets[i * 2] = (wave.x / width) * 2 - 1
        offsets[i * 2 + 1] = (wave.y / height) * 2 - 1
        scales[i * 2] = (half / width) * 2
        scales[i * 2 + 1] = (half / height) * 2
        opacities[i] = wave.opacity
      }
      geometry.attributes.iOffset.needsUpdate = true
      geometry.attributes.iScale.needsUpdate = true
      geometry.attributes.iOpacity.needsUpdate = true
      renderer.render({ scene: waveMesh, target: displacementTarget, clear: true })
      renderer.render({ scene: compositeMesh })
    }
    // Reduced motion: draw a single still frame.
    if (reduceMotion) requestAnimationFrame(() => { visible = true; loop(performance.now()); visible = false; cancelAnimationFrame(raf) })

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
      geometry.remove()
      triangle.remove()
      waveProgram.remove()
      compositeProgram.remove()
      gl.deleteTexture(imageTexture.texture)
      gl.deleteTexture(displacementTarget.texture.texture)
      if (canvas.parentNode === mount) mount.removeChild(canvas)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [source, quality])

  return <div ref={mountRef} className={'ripple-distortion' + (props.className ? ' ' + props.className : '')} style={props.style} />
}
