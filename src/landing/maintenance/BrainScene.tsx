import { useEffect, useRef } from 'react'
import { brainSurface, buildBrain, FOCUS_POINTS } from './brain-model'
import type { Strand } from './brain-model'

/**
 * The living brain.
 *
 * three.js is imported at runtime, so it stays in its own chunk: the page's
 * first paint is the SVG poster, and this only replaces it once a frame is on
 * screen. Rendering stops when the tab is hidden or the scene scrolls away.
 *
 * Everything here is built from `brain-model`, the same data as the poster, so
 * the swap is invisible and the fallback is the same object at rest.
 */


const BASE_YAW = -1.2

export default function BrainScene({ onReady, focus = -1 }: { onReady?: () => void; focus?: number }) {
  const host = useRef<HTMLDivElement>(null)
  const focusRef = useRef(focus)
  focusRef.current = focus
  const readyOnce = useRef(onReady)
  readyOnce.current = onReady

  useEffect(() => {
    const el = host.current
    if (!el) return

    let disposed = false
    let teardown = () => {}
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    void (async () => {
      let THREE: typeof import('three')
      let RoomEnvironment: typeof import('three/examples/jsm/environments/RoomEnvironment.js').RoomEnvironment
      let mergeGeometries: typeof import('three/examples/jsm/utils/BufferGeometryUtils.js').mergeGeometries
      try {
        THREE = await import('three')
        ;({ RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js'))
        ;({ mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js'))
      } catch {
        return // the poster stays
      }
      if (disposed) return

      const model = buildBrain()
      const scene = new THREE.Scene()
      const brain = new THREE.Group()
      scene.add(brain)
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60)
      camera.position.set(0, -0.14, 4.1)
      camera.lookAt(0, -0.17, 0)

      let renderer: import('three').WebGLRenderer
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
      } catch {
        return // no WebGL: the poster stays
      }
      renderer.setClearColor(0x000000, 0)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.05
      el.appendChild(renderer.domElement)

      const pmrem = new THREE.PMREMGenerator(renderer)
      const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
      scene.environment = envTexture
      pmrem.dispose()

      scene.add(new THREE.AmbientLight(0xfff3df, 0.5))
      const key = new THREE.DirectionalLight(0xfff8ec, 2.4)
      key.position.set(2.6, 3.2, 3.4)
      scene.add(key)
      const rim = new THREE.DirectionalLight(0x2f5cff, 2.6)
      rim.position.set(-3.2, 0.4, -1.8)
      scene.add(rim)
      const fill = new THREE.PointLight(0x9dc0ff, 9, 9, 2)
      fill.position.set(0.4, 1.6, 2.6)
      scene.add(fill)

      /* ---- outer volume: the same surface the strands sit on, so the brain
         reads as one mass with light behind the lines, not a dot cloud ---- */
      const shellMat = new THREE.MeshPhysicalMaterial({
        color: 0xf1ece0,
        roughness: 0.5,
        metalness: 0,
        clearcoat: 0.5,
        clearcoatRoughness: 0.5,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.FrontSide,
        envMapIntensity: 0.6,
      })
      {
        const geometry = new THREE.SphereGeometry(1, 128, 96)
        const positions = geometry.attributes.position as import('three').BufferAttribute
        const vertex = new THREE.Vector3()
        for (let i = 0; i < positions.count; i += 1) {
          vertex.fromBufferAttribute(positions, i)
          const p = brainSurface({ x: vertex.x, y: vertex.y, z: vertex.z })
          positions.setXYZ(i, p.x, p.y, p.z)
        }
        positions.needsUpdate = true
        geometry.computeVertexNormals()
        const shell = new THREE.Mesh(geometry, shellMat)
        shell.renderOrder = -1
        brain.add(shell)
      }

      /* ---- strands ---- */
      const curves = model.strands.map((strand) => {
        const closed = strand.region !== 'stem'
        return new THREE.CatmullRomCurve3(
          strand.points.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
          closed,
          'catmullrom',
          0.4,
        )
      })

      const strandMaterial = () =>
        new THREE.MeshPhysicalMaterial({
          color: 0x647db3,
          metalness: 0.18,
          roughness: 0.2,
          clearcoat: 0.9,
          clearcoatRoughness: 0.28,
          transparent: true,
          opacity: 0.62,
          depthWrite: false,
          side: THREE.DoubleSide,
          envMapIntensity: 1.5,
        })

      const stableMaterial = strandMaterial()
      const splitMaterial = strandMaterial()
      splitMaterial.color = new THREE.Color(0x8aa5d8)
      splitMaterial.opacity = 0.5

      const makeStrandMesh = (keep: (s: Strand) => boolean, material: import('three').Material) => {
        const parts: import('three').BufferGeometry[] = []
        model.strands.forEach((strand, i) => {
          if (!keep(strand)) return
          const closed = strand.region !== 'stem'
          parts.push(new THREE.TubeGeometry(curves[i], 148, 0.0115, 4, closed))
        })
        if (!parts.length) return null
        const merged = mergeGeometries(parts, false)
        parts.forEach((g) => g.dispose())
        if (!merged) return null
        const mesh = new THREE.Mesh(merged, material)
        mesh.renderOrder = 0
        brain.add(mesh)
        return mesh
      }

      makeStrandMesh((s) => !s.splits, stableMaterial)
      makeStrandMesh((s) => s.splits, splitMaterial)

      /* ---- nodes ---- */
      const nodeGeometry = new THREE.SphereGeometry(0.0125, 8, 6)
      const nodeMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 })
      const nodeMesh = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, model.nodes.length)
      nodeMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
      const nodeMatrix = new THREE.Matrix4()
      model.nodes.forEach((node, i) => {
        nodeMatrix.makeTranslation(node.x, node.y, node.z)
        nodeMesh.setMatrixAt(i, nodeMatrix)
      })
      const NODE_DIM = new THREE.Color(0x2b3f7d)
      const NODE_LIT = new THREE.Color(0x6f9bff)
      const nodeColor = new THREE.Color()
      model.nodes.forEach((_, i) => nodeMesh.setColorAt(i, NODE_DIM))
      nodeMesh.instanceColor!.needsUpdate = true
      nodeMesh.renderOrder = 1
      brain.add(nodeMesh)

      const nodesByStrand: number[][] = model.strands.map(() => [])
      model.nodes.forEach((node, i) => nodesByStrand[node.strand].push(i))

      /* ---- signals ---- */
      const SIGNAL_COUNT = 16
      const signalGeometry = new THREE.SphereGeometry(0.027, 10, 8)
      const signalMaterial = new THREE.MeshBasicMaterial({ color: 0x3d6dff })
      const signalMesh = new THREE.InstancedMesh(signalGeometry, signalMaterial, SIGNAL_COUNT)
      signalMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      signalMesh.renderOrder = 2
      brain.add(signalMesh)

      // A soft additive halo, so a signal reads as light without becoming a
      // particle blob.
      const glowCanvas = document.createElement('canvas')
      glowCanvas.width = glowCanvas.height = 64
      const glowCtx = glowCanvas.getContext('2d')!
      const gradient = glowCtx.createRadialGradient(32, 32, 0, 32, 32, 32)
      gradient.addColorStop(0, 'rgba(80,140,255,0.9)')
      gradient.addColorStop(0.45, 'rgba(50,100,255,0.28)')
      gradient.addColorStop(1, 'rgba(30,70,255,0)')
      glowCtx.fillStyle = gradient
      glowCtx.fillRect(0, 0, 64, 64)
      const glowTexture = new THREE.CanvasTexture(glowCanvas)
      const glowMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0.9,
      })

      const signals = Array.from({ length: SIGNAL_COUNT }, (_, i) => {
        const strand = (i * 5 + 4) % model.strands.length
        return {
          strand,
          at: ((i * 0.137) % 1 + 1) % 1,
          speed: 0.055 + ((i * 0.019) % 0.06),
          glow: new THREE.Sprite(glowMaterial),
        }
      })
      signals.forEach((s) => {
        s.glow.scale.setScalar(0.22)
        brain.add(s.glow)
      })

      /* ---- the section that lifts into paper ---- */
      const fragmentGeometry = new THREE.PlaneGeometry(0.105, 0.074, 4, 3)
      const position = fragmentGeometry.attributes.position as import('three').BufferAttribute
      for (let i = 0; i < position.count; i += 1) {
        const x = position.getX(i)
        position.setZ(i, Math.sin(x * 18) * 0.016)
      }
      position.needsUpdate = true
      fragmentGeometry.computeVertexNormals()

      const fragmentMaterial = new THREE.MeshStandardMaterial({
        color: 0xf3eee1,
        roughness: 0.92,
        metalness: 0,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
      })
      const fragmentMesh = new THREE.InstancedMesh(
        fragmentGeometry,
        fragmentMaterial,
        model.fragments.length,
      )
      fragmentMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      fragmentMesh.frustumCulled = false
      brain.add(fragmentMesh)

      const fragMatrix = new THREE.Matrix4()
      const fragQuat = new THREE.Quaternion()
      const fragEuler = new THREE.Euler()
      const fragPos = new THREE.Vector3()
      const fragScale = new THREE.Vector3()

      /* ---- camera framing ---- */
      const resize = () => {
        const w = el.clientWidth
        const h = el.clientHeight
        if (!w || !h) return
        renderer.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        const halfH = 0.99
        const halfW = 1.12
        const fit = Math.max(halfH, halfW / camera.aspect)
        const distance = fit / Math.tan((camera.fov * Math.PI) / 360)
        camera.position.z = distance
        camera.lookAt(0, -0.17, 0)
      }
      const resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(el)
      resize()

      /* ---- interaction ---- */
      const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
      const onPointerMove = (e: PointerEvent) => {
        const rect = el.getBoundingClientRect()
        pointer.tx = ((e.clientX - rect.left) / rect.width - 0.5) * 2
        pointer.ty = ((e.clientY - rect.top) / rect.height - 0.5) * 2
      }
      const onPointerLeave = () => {
        pointer.tx = 0
        pointer.ty = 0
      }
      el.addEventListener('pointermove', onPointerMove)
      el.addEventListener('pointerleave', onPointerLeave)

      /* ---- animation ---- */
      const clock = new THREE.Clock()
      const CYCLE = 18
      let time = 0
      let raf = 0
      let inView = true
      let visible = !document.hidden

      const smooth = (a: number, b: number, x: number) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
        return t * t * (3 - 2 * t)
      }

      const signalMatrix = new THREE.Matrix4()
      const point = new THREE.Vector3()

      const render = (advance: boolean) => {
        const dt = advance ? Math.min(clock.getDelta(), 0.05) : 0
        if (advance) time += dt

        pointer.x += (pointer.tx - pointer.x) * 0.045
        pointer.y += (pointer.ty - pointer.y) * 0.045

        brain.rotation.y = BASE_YAW + Math.sin(time * 0.17) * 0.045 + pointer.x * 0.07
        brain.rotation.x = Math.sin(time * 0.13 + 1.1) * 0.02 + pointer.y * 0.05

        // Signals travel their strand, lighting the nodes they pass.
        const lit = new Float32Array(model.nodes.length)
        signals.forEach((signal, i) => {
          if (advance) {
            signal.at = (signal.at + signal.speed * dt) % 1
          }
          curves[signal.strand].getPointAt(signal.at, point)
          signalMatrix.makeTranslation(point.x, point.y, point.z)
          signalMesh.setMatrixAt(i, signalMatrix)
          signal.glow.position.copy(point)
          signal.glow.scale.setScalar(0.2 + Math.sin(time * 2.2 + i) * 0.012)

          for (const nodeIndex of nodesByStrand[signal.strand]) {
            const node = model.nodes[nodeIndex]
            let d = Math.abs(node.t - signal.at)
            if (d > 0.5) d = 1 - d
            const amount = Math.exp(-(d * 26) * (d * 26))
            if (amount > lit[nodeIndex]) lit[nodeIndex] = amount
          }
        })
        signalMesh.instanceMatrix.needsUpdate = true

        const focusIndex = focusRef.current
        const anchor = focusIndex >= 0 ? FOCUS_POINTS[focusIndex] : null
        const focusPulse = 0.72 + Math.sin(time * 2.6) * 0.28

        for (let i = 0; i < model.nodes.length; i += 1) {
          let amount = lit[i]
          if (anchor) {
            const node = model.nodes[i]
            const d = Math.hypot(node.x - anchor.x, node.y - anchor.y, node.z - anchor.z)
            const near = Math.exp(-(d * d) / (0.3 * 0.3)) * focusPulse
            if (near > amount) amount = near
          }
          if (amount < 0.01) {
            nodeColor.copy(NODE_DIM)
          } else {
            nodeColor.copy(NODE_DIM).lerp(NODE_LIT, Math.min(1, amount * 1.15))
          }
          nodeMesh.setColorAt(i, nodeColor)
        }
        nodeMesh.instanceColor!.needsUpdate = true

        // The patch: strands let go, paper lifts, then everything settles back.
        const cycle = (time % CYCLE) / CYCLE
        const separation =
          smooth(0.14, 0.3, cycle) * (1 - smooth(0.68, 0.84, cycle))
        splitMaterial.opacity = 0.5 * (1 - separation * 0.94)
        fragmentMaterial.opacity = separation

        model.fragments.forEach((fragment, i) => {
          const drift = separation * (0.34 + (i % 5) * 0.035)
          fragPos.set(
            fragment.x + fragment.nx * drift + Math.sin(time * 0.8 + fragment.rx) * 0.02 * separation,
            fragment.y + fragment.ny * drift + Math.cos(time * 0.7 + fragment.ry) * 0.02 * separation,
            fragment.z + fragment.nz * drift,
          )
          fragEuler.set(
            fragment.rx + separation * 2.1,
            fragment.ry + separation * 1.4,
            fragment.rz + separation * 1.8,
          )
          fragQuat.setFromEuler(fragEuler)
          const scale = separation < 0.01 ? 0 : fragment.size
          fragScale.setScalar(scale)
          fragMatrix.compose(fragPos, fragQuat, fragScale)
          fragmentMesh.setMatrixAt(i, fragMatrix)
        })
        fragmentMesh.instanceMatrix.needsUpdate = true

        renderer.render(scene, camera)
      }

      const loop = () => {
        raf = requestAnimationFrame(loop)
        if (!inView || !visible) return
        render(true)
      }

      const start = () => {
        if (reduce) return
        cancelAnimationFrame(raf)
        clock.getDelta()
        raf = requestAnimationFrame(loop)
      }
      const stop = () => cancelAnimationFrame(raf)

      if (reduce) {
        // One considered frame: no travel, no separation, still lit.
        time = 0
        render(false)
      } else {
        start()
      }
      readyOnce.current?.()

      const onVisibility = () => {
        visible = !document.hidden
        if (visible) start()
        else stop()
      }
      document.addEventListener('visibilitychange', onVisibility)

      const viewObserver = new IntersectionObserver(
        (entries) => {
          inView = entries.some((entry) => entry.isIntersecting)
          if (inView && visible) start()
          else stop()
          if (!inView) cancelAnimationFrame(raf)
        },
        { threshold: 0.05 },
      )
      viewObserver.observe(el)

      teardown = () => {
        cancelAnimationFrame(raf)
        document.removeEventListener('visibilitychange', onVisibility)
        viewObserver.disconnect()
        resizeObserver.disconnect()
        el.removeEventListener('pointermove', onPointerMove)
        el.removeEventListener('pointerleave', onPointerLeave)
        scene.traverse((object) => {
          const mesh = object as import('three').Mesh
          if (mesh.geometry) mesh.geometry.dispose()
          const material = mesh.material as import('three').Material | import('three').Material[]
          if (Array.isArray(material)) material.forEach((m) => m.dispose())
          else material?.dispose()
        })
        shellMat.dispose()
        glowTexture.dispose()
        glowMaterial.dispose()
        envTexture.dispose()
        renderer.dispose()
        renderer.domElement.remove()
      }
    })()

    return () => {
      disposed = true
      teardown()
    }
  }, [])

  return <div ref={host} className="mnt-webgl" />
}







