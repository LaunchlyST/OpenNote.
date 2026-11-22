/**
 * Style 1 Home — "The Digital Portal". A small real-time 3D scene: a retro computer on a
 * desk, a lamp, a pixel-bird that watches the pointer, and the seller's real products as
 * dimensional objects (sheets, books, displays, icon grids). The camera can travel through
 * the monitor into a tunnel built from the product covers.
 *
 * `progress` (0..1) is owned by a GSAP timeline outside this file, so the journey through
 * the screen reverses exactly by reversing that timeline.
 */
import type * as T from 'three'

export interface PortalProduct { id: string; title: string; cover: string | null; kind: Kind; accent: string }
export type Kind = 'sheets' | 'book' | 'video' | 'icons' | 'display'

export function kindOf(p: { format?: string; fileType?: string | null; title: string }): Kind {
  const s = `${p.format ?? ''} ${p.fileType ?? ''} ${p.title}`.toLowerCase()
  if (/\b(pdf|epub|ebook|e-book|book|guide|workbook)\b/.test(s)) return 'book'
  if (/\b(mp4|mov|webm|video|course|lesson|reel)\b/.test(s)) return 'video'
  if (/\b(svg|icon|icons|emoji|sticker)\b/.test(s)) return 'icons'
  if (/\b(psd|template|templates|figma|canva|planner|notion|kit|pack|ai)\b/.test(s)) return 'sheets'
  return 'display'
}

export interface PortalHandle {
  setProgress(p: number): void
  setIntro(t: number): void
  setPaused(paused: boolean): void
  resize(): void
  dispose(): void
}

const SCREEN = { x: 0, y: 1.78, z: 0.62, w: 2.46, h: 1.84 }

export async function createPortal(canvas: HTMLCanvasElement, opts: {
  products: PortalProduct[]
  handle: string
  mobile: boolean
  reduce: boolean
  onSelect: (index: number | null) => void
  onHover: (index: number | null) => void
}): Promise<PortalHandle> {
  const THREE = await import('three')
  const { mobile, reduce } = opts
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.75))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = !mobile
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  const bg = new THREE.Color('#07060b')
  scene.background = bg
  scene.fog = new THREE.Fog(bg, 14, 46)
  const camera = new THREE.PerspectiveCamera(36, 1, 0.03, 120)

  // ---------- textures ----------
  const loader = new THREE.TextureLoader()
  loader.setCrossOrigin('anonymous')
  const texCache = new Map<string, T.Texture>()
  const coverTex = (src: string | null): T.Texture | null => {
    if (!src) return null
    if (texCache.has(src)) return texCache.get(src)!
    // a separate URL so a cached non-CORS response can't taint the canvas
    const t = loader.load(src + (src.includes('?') ? '&' : '?') + 'gl=1', undefined, undefined, () => { /* keep the neutral material */ })
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    texCache.set(src, t)
    return t
  }
  const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h
    draw(c.getContext('2d')!)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    return t
  }

  // ---------- room ----------
  const room = new THREE.Group()
  scene.add(room)
  const wallTex = canvasTex(4, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#0b0a12'); gr.addColorStop(0.7, '#1a1420'); gr.addColorStop(1, '#2a1c1a'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256) })
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 24), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 }))
  wall.position.set(0, 8, -6)
  room.add(wall)
  const woodTex = canvasTex(512, 256, (g) => {
    g.fillStyle = '#4a3123'; g.fillRect(0, 0, 512, 256)
    for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${30 + Math.random() * 40},${18 + Math.random() * 20},10,${0.15 + Math.random() * 0.25})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const y = Math.random() * 256; g.moveTo(0, y); g.bezierCurveTo(170, y + (Math.random() - 0.5) * 20, 340, y + (Math.random() - 0.5) * 20, 512, y + (Math.random() - 0.5) * 10); g.stroke() }
  })
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping; woodTex.repeat.set(3, 2)
  const desk = new THREE.Mesh(new THREE.BoxGeometry(16, 0.36, 8), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.62, metalness: 0.05 }))
  desk.position.set(0, -0.18, 0.6)
  desk.receiveShadow = true
  room.add(desk)

  // ---------- the computer ----------
  const beige = new THREE.MeshStandardMaterial({ color: '#d8cfbf', roughness: 0.55 })
  const beigeDark = new THREE.MeshStandardMaterial({ color: '#b9ae9b', roughness: 0.6 })
  const pc = new THREE.Group()
  room.add(pc)
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.3, 2.75, 2.2), beige)
  body.position.set(0, 1.8, -0.62)
  body.castShadow = true
  pc.add(body)
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 1.2), beigeDark)
  back.position.set(0, 1.75, -2.2)
  pc.add(back)
  // bezel: a frame around the screen opening (so the screen is a window, not a sticker)
  const bz = 0.62, fw = 3.3, fh = 2.75, d = 0.16
  const bezel = (w: number, h: number, x: number, y: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), beige); m.position.set(x, y, bz); m.castShadow = true; pc.add(m) }
  bezel(fw, (fh - SCREEN.h) / 2, 0, SCREEN.y + SCREEN.h / 2 + (fh - SCREEN.h) / 4)
  bezel(fw, (fh - SCREEN.h) / 2, 0, SCREEN.y - SCREEN.h / 2 - (fh - SCREEN.h) / 4)
  bezel((fw - SCREEN.w) / 2, SCREEN.h, -SCREEN.w / 2 - (fw - SCREEN.w) / 4, SCREEN.y)
  bezel((fw - SCREEN.w) / 2, SCREEN.h, SCREEN.w / 2 + (fw - SCREEN.w) / 4, SCREEN.y)
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.02), new THREE.MeshStandardMaterial({ color: '#8f8576' }))
  badge.position.set(0, SCREEN.y - SCREEN.h / 2 - 0.25, bz + 0.09)
  pc.add(badge)
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: '#57ff8a' }))
  led.position.set(1.35, SCREEN.y - SCREEN.h / 2 - 0.25, bz + 0.09)
  pc.add(led)
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.95, 0.3, 24), beigeDark)
  stand.position.set(0, 0.15, -0.6)
  pc.add(stand)

  // the screen: an animated canvas (grid world, scanlines, the products drifting by)
  const SW = mobile ? 384 : 640, SH = Math.round(SW * 0.75)
  const sc = document.createElement('canvas'); sc.width = SW; sc.height = SH
  const sg = sc.getContext('2d')!
  const screenTex = new THREE.CanvasTexture(sc); screenTex.colorSpace = THREE.SRGBColorSpace
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false })
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), screenMat)
  screen.position.set(SCREEN.x, SCREEN.y, SCREEN.z)
  pc.add(screen)
  const coverImgs: Array<HTMLImageElement | null> = opts.products.map((p) => {
    if (!p.cover) return null
    const im = new Image(); im.crossOrigin = 'anonymous'; im.src = p.cover + (p.cover.includes('?') ? '&' : '?') + 'gl=1'
    return im
  })

  const screenGlow = new THREE.PointLight('#5b86ff', 0, 9, 1.6)
  screenGlow.position.set(0, SCREEN.y, SCREEN.z + 1.2)
  room.add(screenGlow)

  // keyboard
  const keysTex = canvasTex(512, 160, (g) => {
    g.fillStyle = '#cfc5b3'; g.fillRect(0, 0, 512, 160)
    for (let r = 0; r < 5; r++) for (let c = 0; c < 16; c++) { g.fillStyle = r === 4 && c > 4 && c < 11 ? '#e6ddcc' : '#ece4d4'; g.fillRect(8 + c * 31.2, 8 + r * 29, 27, 24); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(8 + c * 31.2, 28 + r * 29, 27, 4) }
  })
  const keyboard = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.14, 1.0), [beigeDark, beigeDark, new THREE.MeshStandardMaterial({ map: keysTex, roughness: 0.5 }), beigeDark, beigeDark, beigeDark])
  keyboard.position.set(-0.2, 0.07, 2.15)
  keyboard.rotation.y = 0.04
  keyboard.castShadow = true
  room.add(keyboard)

  // desk lamp (left): base, arm, shade and a warm bulb
  const metal = new THREE.MeshStandardMaterial({ color: '#2a2522', roughness: 0.35, metalness: 0.7 })
  const lamp = new THREE.Group()
  lamp.position.set(-3.6, 0, -0.4)
  const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.12, 24), metal); lb.position.y = 0.06; lamp.add(lb)
  const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), metal); a1.position.set(0.2, 1.3, 0); a1.rotation.z = -0.18; lamp.add(a1)
  const a2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8), metal); a2.position.set(0.85, 2.85, 0.1); a2.rotation.z = -1.15; lamp.add(a2)
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.7, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#d0571c', roughness: 0.45, side: THREE.DoubleSide }))
  shade.position.set(1.62, 3.05, 0.2); shade.rotation.z = -0.5; lamp.add(shade)
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffd9a0' }))
  bulb.position.set(1.72, 2.82, 0.2); lamp.add(bulb)
  room.add(lamp)

  // a few leaves (the plant from the seller's artwork), kept simple
  const leafMat = new THREE.MeshStandardMaterial({ color: '#3f7a3a', roughness: 0.7, side: THREE.DoubleSide })
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), leafMat)
    leaf.scale.set(0.5, 0.08, 1)
    leaf.position.set(-5.4 + Math.sin(i * 1.7) * 0.7, 2.6 + i * 0.32, -2.4 + Math.cos(i) * 0.4)
    leaf.rotation.set(0.5 + i * 0.3, i * 0.9, 0.7)
    room.add(leaf)
  }

  // ---------- the bird ----------
  const bird = new THREE.Group()
  const white = new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.75 })
  const grey = new THREE.MeshStandardMaterial({ color: '#b8b4ad', roughness: 0.8 })
  const bBody = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), white); bBody.scale.set(0.95, 0.85, 1.25); bBody.castShadow = true; bird.add(bBody)
  const head = new THREE.Group(); head.position.set(0, 0.55, 0.42); bird.add(head)
  const bHead = new THREE.Mesh(new THREE.SphereGeometry(0.33, 20, 16), white); head.add(bHead)
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 12), new THREE.MeshStandardMaterial({ color: '#ef8a2c', roughness: 0.5 })); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.04, 0.38); head.add(beak)
  const eyeM = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.2 })
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), eyeM); e.position.set(0.19 * s, 0.07, 0.24); head.add(e) }
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), grey); w.scale.set(0.25, 0.6, 1); w.position.set(0.44 * s, 0.05, -0.08); w.rotation.y = 0.18 * s; bird.add(w) }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 10), grey); tail.rotation.x = -Math.PI / 2 - 0.4; tail.position.set(0, 0.08, -0.72); bird.add(tail)
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), new THREE.MeshStandardMaterial({ color: '#d98a3a' })); leg.position.set(0.15 * s, -0.48, 0.05); bird.add(leg) }
  bird.position.set(2.45, 0.62, 1.5)
  bird.rotation.y = -0.55
  bird.scale.setScalar(0.92)
  room.add(bird)

  // ---------- products as dimensional objects ----------
  const SLOTS: Array<[number, number, number, number]> = mobile
    ? [[-1.75, 3.55, 1.4, 0.3], [1.8, 3.7, 1.2, -0.3], [0, 4.6, 0.4, 0]]
    : [[-3.4, 2.5, 1.6, 0.45], [3.6, 2.85, 1.2, -0.5], [-2.2, 4.15, 0.2, 0.25], [2.35, 4.4, -0.1, -0.25], [-4.6, 1.2, 2.8, 0.6], [4.8, 1.5, 2.6, -0.6]]
  const products = opts.products.slice(0, SLOTS.length)
  type Obj = { g: T.Group; base: T.Vector3; rot: number; hover: number; sel: number; kind: Kind; parts: T.Object3D[]; dir: T.Vector3 }
  const objs: Obj[] = []
  const neutral = (accent: string) => new THREE.MeshStandardMaterial({ color: new THREE.Color(accent).lerp(new THREE.Color('#ffffff'), 0.55), roughness: 0.5 })
  products.forEach((p, i) => {
    const [x, y, z, ry] = SLOTS[i]
    const g = new THREE.Group()
    const t = coverTex(p.cover)
    const face = t ? new THREE.MeshStandardMaterial({ map: t, roughness: 0.45 }) : neutral(p.accent)
    const accent = new THREE.MeshStandardMaterial({ color: p.accent, roughness: 0.4, metalness: 0.1 })
    const paper = new THREE.MeshStandardMaterial({ color: '#f4f0e8', roughness: 0.8 })
    const parts: T.Object3D[] = []
    if (p.kind === 'book') {
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.25, 0.22), [paper, accent, paper, paper, face, accent])
      g.add(book); parts.push(book)
    } else if (p.kind === 'video') {
      const fr = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 0.08), new THREE.MeshStandardMaterial({ color: '#16151a', roughness: 0.3, metalness: 0.4 }))
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 0.82), face); pl.position.z = 0.045
      const play = new THREE.Mesh(new THREE.CircleGeometry(0.14, 3), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 })); play.position.z = 0.05; play.rotation.z = -Math.PI / 2
      g.add(fr, pl, play); parts.push(pl, play)
    } else if (p.kind === 'icons') {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const tt = t ? t.clone() : null
        if (tt) { tt.repeat.set(1 / 3, 1 / 3); tt.offset.set(c / 3, 1 - (r + 1) / 3); tt.needsUpdate = true }
        const tile = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.1), [accent, accent, accent, accent, tt ? new THREE.MeshStandardMaterial({ map: tt, roughness: 0.4 }) : neutral(p.accent), accent])
        tile.position.set((c - 1) * 0.36, (1 - r) * 0.36, 0)
        g.add(tile); parts.push(tile)
      }
    } else if (p.kind === 'sheets') {
      for (let k = 2; k >= 0; k--) {
        const sh = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.2, 0.02), k === 0 ? [paper, paper, paper, paper, face, paper] : [paper, paper, paper, paper, k === 1 ? accent : paper, paper])
        sh.position.set(k * 0.07, -k * 0.05, -k * 0.09); sh.rotation.z = k * 0.06
        g.add(sh); parts.push(sh)
      }
    } else {
      const disp = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 0.06), [accent, accent, accent, accent, face, accent])
      g.add(disp); parts.push(disp)
    }
    g.traverse((o) => { if ((o as T.Mesh).isMesh) (o as T.Mesh).castShadow = !mobile })
    g.position.set(x, y, z); g.rotation.y = ry
    g.userData.index = i
    room.add(g)
    const dir = new THREE.Vector3(x - SCREEN.x, y - SCREEN.y, 0).normalize()
    objs.push({ g, base: new THREE.Vector3(x, y, z), rot: ry, hover: 0, sel: 0, kind: p.kind, parts, dir })
  })

  // ---------- tunnel behind the screen ----------
  const tunnel = new THREE.Group()
  tunnel.visible = false
  scene.add(tunnel)
  const accents = opts.products.map((p) => p.accent)
  const tunnelMats = (opts.products.length ? opts.products : [{ cover: null, accent: '#7c5cff' } as PortalProduct]).map((p) => {
    const t = coverTex(p.cover)
    return t ? new THREE.MeshBasicMaterial({ map: t, toneMapped: false, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }) : new THREE.MeshBasicMaterial({ color: p.accent, side: THREE.DoubleSide })
  })
  const RINGS = mobile ? 10 : 16, PER = mobile ? 6 : 8
  for (let r = 0; r < RINGS; r++) {
    const z = SCREEN.z - 2 - r * 2.6
    for (let k = 0; k < PER; k++) {
      const a = (k / PER) * Math.PI * 2 + r * 0.35
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.6), tunnelMats[(r * PER + k) % tunnelMats.length])
      pl.position.set(Math.cos(a) * 2.6, SCREEN.y + Math.sin(a) * 2.6, z)
      pl.lookAt(new THREE.Vector3(0, SCREEN.y, z))
      tunnel.add(pl)
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.02, 6, 64), new THREE.MeshBasicMaterial({ color: accents[r % Math.max(1, accents.length)] ?? '#8fb3ff', toneMapped: false }))
    ring.position.set(0, SCREEN.y, z - 1.3)
    tunnel.add(ring)
  }
  const endGlow = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: '#fbf6ee', toneMapped: false, transparent: true, opacity: 0 }))
  endGlow.position.set(0, SCREEN.y, SCREEN.z - 2 - RINGS * 2.6 - 2)
  tunnel.add(endGlow)

  // ---------- lights ----------
  const amb = new THREE.AmbientLight('#7d7fa8', 0.0); scene.add(amb)
  const hemi = new THREE.HemisphereLight('#9fb4ff', '#3a2418', 0.0); scene.add(hemi)
  const lampLight = new THREE.SpotLight('#ffb36b', 0, 22, 0.85, 0.55, 1.2)
  lampLight.position.set(-1.9, 3.0, -0.2); lampLight.target.position.set(0.5, 0, 1.2)
  lampLight.castShadow = !mobile; lampLight.shadow.mapSize.set(1024, 1024)
  scene.add(lampLight, lampLight.target)
  const rim = new THREE.DirectionalLight('#7aa0ff', 0); rim.position.set(4, 6, -6); scene.add(rim)
  const sweep = new THREE.PointLight('#ffe2b8', 0, 7, 1.4); sweep.position.set(-6, 0.8, 2.5); scene.add(sweep)

  // ---------- state ----------
  let progress = 0, intro = reduce ? 1 : 0, paused = false, raf = 0, disposed = false
  const ptr = new THREE.Vector2(0, 0), ptrS = new THREE.Vector2(0, 0)
  let hovered: number | null = null, selected: number | null = null
  const ray = new THREE.Raycaster()
  const offsetX = mobile ? 0 : 1.7 // composition: copy on the left, the computer right of centre
  const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
  const ease3 = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

  const resize = () => {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    if (mobile || progress > 0.02) return
    ray.setFromCamera(ptr, camera)
    const hit = ray.intersectObjects(objs.map((o) => o.g), true)[0]
    let idx: number | null = null
    if (hit) { let o: T.Object3D | null = hit.object; while (o && o.userData.index === undefined) o = o.parent; idx = o ? (o.userData.index as number) : null }
    if (idx !== hovered) { hovered = idx; canvas.style.cursor = idx === null ? '' : 'pointer'; opts.onHover(idx) }
  }
  const onClick = (e: MouseEvent) => {
    if (progress > 0.02) return
    const r = canvas.getBoundingClientRect()
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ptr, camera)
    const hit = ray.intersectObjects(objs.map((o) => o.g), true)[0]
    let idx: number | null = null
    if (hit) { let o: T.Object3D | null = hit.object; while (o && o.userData.index === undefined) o = o.parent; idx = o ? (o.userData.index as number) : null }
    selected = idx
    opts.onSelect(idx)
  }
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('click', onClick)

  // ---------- the animated monitor ----------
  const drawScreen = (time: number, power: number, flash: number) => {
    const g = sg
    g.fillStyle = '#04060f'; g.fillRect(0, 0, SW, SH)
    if (power <= 0) { screenTex.needsUpdate = true; return }
    g.save()
    // power-on: a line that opens into the picture
    const open = Math.min(1, power * 1.6)
    g.beginPath(); g.rect(0, SH / 2 - (SH / 2) * open, SW, SH * open + 1); g.clip()
    const sky = g.createLinearGradient(0, 0, 0, SH)
    sky.addColorStop(0, '#0b1240'); sky.addColorStop(0.55, '#3a1d6e'); sky.addColorStop(0.62, '#ff6d8a'); sky.addColorStop(1, '#14082b')
    g.fillStyle = sky; g.fillRect(0, 0, SW, SH)
    // sun
    const hz = SH * 0.6
    g.fillStyle = '#ffb36b'; g.beginPath(); g.arc(SW / 2, hz, SW * 0.13, Math.PI, 0); g.fill()
    g.fillStyle = '#14082b'; for (let i = 0; i < 5; i++) g.fillRect(SW / 2 - SW * 0.14, hz - 6 - i * 9, SW * 0.28, 2 + i * 0.6)
    // perspective grid moving toward the viewer
    g.strokeStyle = 'rgba(120,200,255,.55)'; g.lineWidth = 1
    const tt = (time * 0.35) % 1
    for (let i = 0; i < 14; i++) { const p = Math.pow((i + tt) / 14, 2.2); const y = hz + (SH - hz) * p; g.beginPath(); g.moveTo(0, y); g.lineTo(SW, y); g.stroke() }
    for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(SW / 2 + i * 6, hz); g.lineTo(SW / 2 + i * SW * 0.09, SH); g.stroke() }
    // products drifting across the horizon as glowing cards
    const n = coverImgs.length
    for (let k = 0; k < n; k++) {
      const im = coverImgs[k]
      const ph = ((time * 0.06 + k / Math.max(1, n)) % 1)
      const x = -SW * 0.2 + ph * SW * 1.4, y = SH * 0.22 + Math.sin(time + k) * SH * 0.04
      const w = SW * 0.16, h = w * 1.25
      g.save(); g.globalAlpha = 0.92; g.shadowColor = '#9fd3ff'; g.shadowBlur = 18
      g.fillStyle = '#ffffff'; g.fillRect(x - 3, y - 3, w + 6, h + 6)
      if (im && im.complete && im.naturalWidth) { try { g.drawImage(im, x, y, w, h) } catch { /* tainted: skip */ } }
      else { g.fillStyle = accents[k] ?? '#7c5cff'; g.fillRect(x, y, w, h) }
      g.restore()
    }
    // the store handle, typed onto the screen
    g.font = `700 ${Math.round(SW * 0.045)}px ui-monospace, Menlo, monospace`
    g.fillStyle = '#e8f3ff'; g.textAlign = 'left'
    const label = `> @${opts.handle}`
    const shown = label.slice(0, Math.floor(Math.min(1, power * 1.2) * label.length))
    g.fillText(shown + (Math.floor(time * 2) % 2 ? '_' : ''), SW * 0.05, SH * 0.1)
    g.restore()
    // scanlines + vignette
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < SH; y += 3) g.fillRect(0, y, SW, 1)
    const v = g.createRadialGradient(SW / 2, SH / 2, SW * 0.2, SW / 2, SH / 2, SW * 0.7)
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = v; g.fillRect(0, 0, SW, SH)
    if (flash > 0) { g.fillStyle = `rgba(250,246,238,${Math.min(1, flash)})`; g.fillRect(0, 0, SW, SH) }
    screenTex.needsUpdate = true
  }

  // ---------- frame ----------
  const camPos = new THREE.Vector3(), look = new THREE.Vector3()
  const clock = new THREE.Clock()
  let last = 0
  const frame = () => {
    raf = requestAnimationFrame(frame)
    if (paused || disposed) return
    const time = clock.getElapsedTime()
    const dt = Math.min(0.05, time - last); last = time
    ptrS.lerp(ptr, 1 - Math.pow(0.001, dt))
    const i0 = intro
    // Scene A: lights, camera settle, screen power, products appear
    const lightsOn = smooth(0.0, 0.35, i0), sweepT = smooth(0.15, 0.45, i0), power = smooth(0.4, 0.7, i0), prodIn = smooth(0.55, 0.85, i0)
    amb.intensity = 0.32 * lightsOn
    hemi.intensity = 0.35 * lightsOn
    lampLight.intensity = 26 * lightsOn
    rim.intensity = 0.9 * lightsOn
    sweep.intensity = 14 * Math.sin(sweepT * Math.PI)
    sweep.position.x = -6 + sweepT * 12
    bulb.material.color.setScalar(0.4 + 0.6 * lightsOn).multiply(new THREE.Color('#ffd9a0'))
    led.visible = power > 0.05

    const p = progress
    // ----- camera path, driven only by `progress` so it reverses exactly -----
    const homeZ = mobile ? 12.5 : 10.2, homeY = mobile ? 2.6 : 2.25
    const introPush = (1 - ease3(Math.min(1, i0 * 1.4))) * 2.2
    const parX = reduce ? 0 : ptrS.x * 0.55, parY = reduce ? 0 : ptrS.y * 0.3
    const a = ease3(smooth(0, 0.42, p))            // approach the monitor
    const cross = smooth(0.42, 0.52, p)             // through the glass
    const fly = smooth(0.5, 1, p)                   // down the tunnel
    const hx = offsetX * (1 - a)
    const nearZ = SCREEN.z + 0.9
    camPos.set(
      THREE.MathUtils.lerp(parX - hx, SCREEN.x, a),
      THREE.MathUtils.lerp(homeY + parY, SCREEN.y, a),
      THREE.MathUtils.lerp(homeZ + introPush, nearZ, a) - cross * 1.4 - Math.pow(fly, 1.6) * (RINGS * 2.6 + 1),
    )
    camera.position.copy(camPos)
    look.set(THREE.MathUtils.lerp(-hx * 0.4 + parX * 0.3, SCREEN.x, a), THREE.MathUtils.lerp(1.55, SCREEN.y, a), camPos.z - 6)
    camera.lookAt(look)
    camera.rotation.z = fly * 0.9
    camera.fov = THREE.MathUtils.lerp(36, 30, a) + fly * 22
    camera.updateProjectionMatrix()

    // the room only exists in front of the glass
    const inside = camPos.z < SCREEN.z - 0.02
    room.visible = !inside
    tunnel.visible = inside || p > 0.4
    tunnel.rotation.z = time * 0.08 + fly * 1.5
    endGlow.material.opacity = smooth(0.8, 1, p)

    // Scene B: products float, open on hover, part from the screen as the camera approaches
    objs.forEach((o, k) => {
      const appear = smooth(k * 0.08, 0.6 + k * 0.08, prodIn)
      const want = (hovered === k ? 1 : 0)
      o.hover += (want - o.hover) * (1 - Math.pow(0.002, dt))
      o.sel += ((selected === k ? 1 : 0) - o.sel) * (1 - Math.pow(0.002, dt))
      const bob = reduce ? 0 : Math.sin(time * 0.9 + k * 1.7) * 0.08
      const out = a * 3.2 + cross * 2
      o.g.position.set(o.base.x + o.dir.x * out, o.base.y + bob + o.dir.y * out + o.hover * 0.12, o.base.z + out * 0.6 + o.sel * 0.4)
      o.g.scale.setScalar(Math.max(0.001, appear * (1 + o.hover * 0.12 + o.sel * 0.1)))
      o.g.rotation.y = o.rot * (1 - o.hover * 0.8) + (reduce ? 0 : Math.sin(time * 0.5 + k) * 0.12) - ptrS.x * 0.15
      o.g.rotation.x = -ptrS.y * 0.08
      // open up on hover: sheets fan out, books turn, icon tiles separate
      if (o.kind === 'sheets') o.parts.forEach((m, j) => { m.position.x = (2 - j) * (0.07 + o.hover * 0.22); m.rotation.z = (2 - j) * (0.06 + o.hover * 0.12) })
      if (o.kind === 'book') o.parts[0].rotation.y = o.hover * -0.9
      if (o.kind === 'icons') o.parts.forEach((m, j) => { const c = j % 3, r = Math.floor(j / 3); m.position.set((c - 1) * (0.36 + o.hover * 0.12), (1 - r) * (0.36 + o.hover * 0.12), Math.sin(j + time) * 0.05 * o.hover) })
    })
    // foreground separates with perspective as we approach
    keyboard.position.y = 0.07 - a * 1.2; keyboard.position.z = 2.15 + a * 2.5
    bird.position.x = 2.45 + a * 2.6
    // the bird: breathes, watches the pointer, hops once when the screen powers on
    const hop = Math.sin(smooth(0.62, 0.8, i0) * Math.PI) * 0.35
    bird.position.y = 0.62 + hop + Math.sin(time * 2.2) * 0.008
    head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, 0.9 + ptrS.x * 0.7, 0.08)
    head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, -ptrS.y * 0.4, 0.08)
    bBody.scale.y = 0.85 + Math.sin(time * 2.2) * 0.015

    const flash = smooth(0.34, 0.47, p) * 1.1 - smooth(0.5, 0.56, p) * 1.1
    drawScreen(time, power, Math.max(0, flash))
    screenMat.color.setScalar(1 + a * 0.8)
    screenGlow.intensity = power * (6 + a * 30) + (hovered !== null ? 2 : 0)
    renderer.render(scene, camera)
  }
  raf = requestAnimationFrame(frame)

  return {
    setProgress(p) { progress = p },
    setIntro(t) { intro = t },
    setPaused(v) { paused = v; if (!v) clock.getDelta() },
    resize,
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('click', onClick)
      scene.traverse((o) => {
        const m = o as T.Mesh
        if (m.geometry) m.geometry.dispose()
        const mat = m.material as T.Material | T.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose()
      })
      texCache.forEach((t) => t.dispose())
      screenTex.dispose()
      renderer.dispose()
    },
  }
}
