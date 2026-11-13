import { useEffect, useRef } from 'react'

/**
 * Glyph background, adapted for Desknoty from the "backgrounds-glyph" shader idea
 * (21st.dev / animate-ui). No extra dependencies: plain WebGL + requestAnimationFrame.
 *
 * The field is made of calendar marks (day numbers and weekday initials) that
 * drift like a misty diary page. The pointer leaves a trail of ink, a press
 * sends a wave of Desknoty blue through the glyphs. Static under reduced motion,
 * paused when the tab is hidden or the field is off screen.
 */

const CHARACTERS = '123456789MTWFS0123456789'
const MAX_WAVES = 8
const TRAIL = 12
const TRAIL_LIFE = 700
const WAVE_LIFE = 3.6
const WAVE_SPEED = 520
const WAVE_SLOWDOWN = 0.66

const VERTEX = `attribute vec2 position; void main(){ gl_Position = vec4(position, 0.0, 1.0); }`

const FRAGMENT = `
precision highp float;
uniform sampler2D atlas;
uniform vec2 size; uniform vec2 cell; uniform float dpr; uniform float count; uniform float time;
uniform float activity; uniform vec3 color; uniform vec3 accent;
uniform vec4 waves[${MAX_WAVES}]; uniform vec4 trail[${TRAIL}];
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x), mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x), u.y); }
void main(){
  vec2 pixel = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y);
  vec2 index = floor(pixel / cell);
  vec2 point = (index + 0.5) * cell / dpr;
  float ring = 0.0;
  for (int i = 0; i < ${MAX_WAVES}; i++) {
    vec4 w = waves[i]; if (w.w <= 0.0) continue;
    vec2 v = point - w.xy; float a = atan(v.y, v.x);
    float shape = 1.0 + 0.08 * sin(3.0 * a + w.w * 4.0) + 0.05 * sin(5.0 * a - w.w * 3.0);
    float d = length(v) - w.z * shape;
    float k = d > 0.0 ? d / 10.0 : d / 34.0;
    ring = max(ring, exp(-k * k) * w.w);
  }
  float hover = 0.0;
  for (int i = 0; i < ${TRAIL}; i++) { vec4 t = trail[i]; if (t.w <= 0.0) continue;
    vec2 v = point - t.xy; hover += t.w * exp(-dot(v, v) / (2.0 * t.z * t.z)); }
  hover = min(hover, 1.0);
  mat2 turn = mat2(0.82, 0.57, -0.57, 0.82);
  vec2 q = turn * (point - vec2(-26.0, 10.0) * time);
  float cloud = noise(vec2(q.x / 150.0, q.y / 84.0) + vec2(time * 0.04, 0.0)) * 0.62
    + noise(vec2(q.x / 64.0, q.y / 38.0) + vec2(3.7, time * 0.06)) * 0.38;
  float mask = pow(smoothstep(0.46 - 0.2 * activity, 0.84, cloud), 2.4);
  float seed = hash(index);
  float epoch = floor(time * 0.08 * (0.4 + seed) + seed * 97.0);
  float ch = floor(hash(index + epoch * 0.137) * count);
  vec2 local = fract(pixel / cell);
  float ink = pow(texture2D(atlas, vec2((ch + local.x) / count, local.y)).a, 1.6);
  float grey = ink * clamp(0.02 + 0.13 * mask * (1.0 + 0.3 * activity) + 0.42 * hover * (0.6 + 0.4 * mask), 0.0, 1.0);
  float blue = ink * ring * 0.8;
  float alpha = grey + blue - grey * blue;
  gl_FragColor = vec4(color * grey * (1.0 - blue) + accent * blue, alpha);
}`

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)
  if (!s) return null
  gl.shaderSource(s, src)
  gl.compileShader(s)
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export type GlyphBackgroundProps = { className?: string; inkColor?: string; waveColor?: string; fontSize?: number }

export function GlyphBackground({ className, inkColor = '#17181a', waveColor = '#0b6fb8', fontSize = 11 }: GlyphBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false })
    if (!gl) return
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX), fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    const prog = gl.createProgram()
    if (!vs || !fs || !prog) return
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const pos = gl.getAttribLocation(prog, 'position')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v)
    const u = (n: string) => gl.getUniformLocation(prog, n)
    const U = { size: u('size'), cell: u('cell'), dpr: u('dpr'), count: u('count'), time: u('time'), activity: u('activity'), color: u('color'), accent: u('accent'), waves: u('waves'), trail: u('trail') }
    gl.uniform1i(u('atlas'), 0)
    gl.uniform1f(U.count, CHARACTERS.length)
    gl.uniform3f(U.color, ...rgb(inkColor))
    gl.uniform3f(U.accent, ...rgb(waveColor))

    let dpr = 1, cell: [number, number] = [7, 14]
    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight
      dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
      canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr))
      const font = `500 ${fontSize * dpr}px 'JetBrains Mono', ui-monospace, monospace`
      const m = document.createElement('canvas').getContext('2d')!
      m.font = font
      cell = [Math.round(m.measureText('0').width * 1.35), Math.round(fontSize * 1.5 * dpr)]
      const atlas = document.createElement('canvas')
      atlas.width = cell[0] * CHARACTERS.length; atlas.height = cell[1]
      const a = atlas.getContext('2d')!
      a.font = font; a.textAlign = 'center'; a.textBaseline = 'middle'; a.fillStyle = '#fff'
      for (let i = 0; i < CHARACTERS.length; i++) a.fillText(CHARACTERS[i], (i + 0.5) * cell[0], cell[1] / 2)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas)
    }

    const waves: { x: number; y: number; born: number; strength: number }[] = []
    const trailPts: { x: number; y: number; t: number }[] = []
    const energy = { value: 0, at: 0 }
    const W = new Float32Array(MAX_WAVES * 4), T = new Float32Array(TRAIL * 4)
    let now = 0

    const draw = () => {
      const s = now / 1000
      W.fill(0)
      waves.forEach((w, i) => {
        const age = s - w.born
        if (age <= 0 || age >= WAVE_LIFE) return
        W[i * 4] = w.x; W[i * 4 + 1] = w.y
        W[i * 4 + 2] = (WAVE_SPEED * age) / (1 + WAVE_SLOWDOWN * age)
        W[i * 4 + 3] = Math.min(1, age / 0.05) * Math.exp(-Math.max(0, age - 0.4) / 1.3) * Math.min(1, (WAVE_LIFE - age) / 0.5) * w.strength
      })
      T.fill(0)
      trailPts.forEach((p, i) => {
        const age = (now - p.t) / TRAIL_LIFE
        if (age < 0 || age >= 1) return
        T[i * 4] = p.x; T[i * 4 + 1] = p.y; T[i * 4 + 2] = 46 + 26 * age; T[i * 4 + 3] = 0.34 * (1 - age) * (1 - age)
      })
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(U.size, canvas.width, canvas.height)
      gl.uniform2f(U.cell, cell[0], cell[1])
      gl.uniform1f(U.dpr, dpr)
      gl.uniform1f(U.time, s)
      gl.uniform1f(U.activity, energy.value * Math.exp(-Math.max(0, now - energy.at) / 900))
      gl.uniform4fv(U.waves, W)
      gl.uniform4fv(U.trail, T)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0, last = performance.now(), visible = true
    const loop = (t: number) => {
      now += Math.min(t - last, 64); last = t
      draw()
      raf = requestAnimationFrame(loop)
    }
    const start = () => { if (!reduce && visible && !document.hidden && !raf) { last = performance.now(); raf = requestAnimationFrame(loop) } }
    const stop = () => { cancelAnimationFrame(raf); raf = 0 }

    const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
    const move = (e: PointerEvent) => {
      if (reduce) return
      const { x, y } = local(e)
      const prev = trailPts[trailPts.length - 1]
      const cur = energy.value * Math.exp(-Math.max(0, now - energy.at) / 900)
      energy.value = Math.min(1, cur + (prev ? Math.hypot(x - prev.x, y - prev.y) : 0) / 600); energy.at = now
      if (prev && Math.hypot(x - prev.x, y - prev.y) < 18) return
      trailPts.push({ x, y, t: now })
      while (trailPts.length > TRAIL || (trailPts[0] && now - trailPts[0].t > TRAIL_LIFE)) trailPts.shift()
    }
    const down = (e: PointerEvent) => {
      if (reduce) return
      const { x, y } = local(e)
      const s = now / 1000
      waves.push({ x, y, born: s, strength: 1 }, { x, y, born: s + 0.3, strength: 0.55 })
      while (waves.length > MAX_WAVES) waves.shift()
    }

    resize(); draw()
    const ro = new ResizeObserver(() => { resize(); draw() })
    ro.observe(canvas)
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); else stop() })
    io.observe(canvas)
    const vis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', vis)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', down, { passive: true })
    start()
    return () => {
      stop(); ro.disconnect(); io.disconnect()
      document.removeEventListener('visibilitychange', vis)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
    }
  }, [inkColor, waveColor, fontSize])

  return <canvas ref={canvasRef} aria-hidden="true" className={className} style={{ pointerEvents: 'none' }} />
}

export default GlyphBackground
