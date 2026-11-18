import * as THREE from 'three'
import { BRAND, type MediaSlotConfig } from './config'

const W = 960
const H = 540

// Сдержанная редакционная карточка вместо имитации видеоплеера.
function paintPlaceholder(
  ctx: CanvasRenderingContext2D,
  t: number,
  i: number,
  kind: 'video' | 'photo',
) {
  const background = ctx.createLinearGradient(0, 0, W, H)
  background.addColorStop(0, '#25201a')
  background.addColorStop(0.55, '#12110f')
  background.addColorStop(1, '#080807')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, W, H)

  // Мягкий отражённый свет на тёмной поверхности.
  const x = W * (0.72 + 0.025 * Math.sin(t * 0.12 + i))
  const glow = ctx.createRadialGradient(x, H * 0.3, 0, x, H * 0.3, W * 0.65)
  glow.addColorStop(0, 'rgba(168, 132, 79, 0.22)')
  glow.addColorStop(0.5, 'rgba(94, 71, 43, 0.08)')
  glow.addColorStop(1, 'rgba(10, 9, 8, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = 'rgba(216, 191, 147, 0.22)'
  ctx.lineWidth = 1
  ctx.strokeRect(26, 26, W - 52, H - 52)
  ctx.beginPath()
  ctx.moveTo(62, H - 103)
  ctx.lineTo(W - 62, H - 103)
  ctx.stroke()

  // Тонкие концентрические дуги добавляют глубину, не перекрывая контент.
  ctx.save()
  ctx.translate(W * 0.76, H * 0.47)
  ctx.strokeStyle = 'rgba(213, 187, 142, 0.10)'
  for (let r = 128; r <= 300; r += 43) {
    ctx.beginPath()
    ctx.arc(0, 0, r, -1.15, 2.2)
    ctx.stroke()
  }
  ctx.restore()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = 'rgba(225, 207, 171, 0.65)'
  ctx.font = '500 15px Manrope, Arial, sans-serif'
  ctx.fillText(`${BRAND.name}  /  ВИЗУАЛЬНАЯ ИСТОРИЯ`, 62, 78)
  ctx.fillStyle = 'rgba(226, 205, 168, 0.7)'
  ctx.font = '400 58px "Cormorant Garamond", Georgia, serif'
  ctx.fillText('Your story,', 64, 245)
  ctx.font = 'italic 58px "Cormorant Garamond", Georgia, serif'
  ctx.fillText('in a new light.', 64, 310)
  ctx.fillStyle = 'rgba(225, 207, 171, 0.38)'
  ctx.font = '500 14px Manrope, Arial, sans-serif'
  ctx.fillText(`${BRAND.name}  /  ${String(i + 1).padStart(2, '0')}`, 64, 350)
  ctx.fillStyle = 'rgba(225, 207, 171, 0.52)'
  ctx.font = '500 14px Manrope, Arial, sans-serif'
  ctx.fillText(kind === 'video' ? 'M O T I O N   /   0 1 — 1 0' : 'S T I L L   /   0 1 — 1 0', 64, H - 64)
  ctx.textAlign = 'right'
  ctx.fillText('Y O U R   S T O R Y   H E R E', W - 64, H - 64)
}

export class MediaSlot {
  cfg: MediaSlotConfig
  index: number
  texture: THREE.Texture
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  video?: HTMLVideoElement
  userMedia = false
  /** uniform: xy = repeat, zw = offset  (cover-кроп) */
  crop = new THREE.Vector4(1, 1, 0, 0)
  private panelAspect = 16 / 9
  private lastPaint = -1
  private objectUrl?: string
  private generation = 0
  private disposed = false
  kind: 'video' | 'photo'

  constructor(cfg: MediaSlotConfig, index: number, panelAspect: number) {
    this.cfg = cfg
    this.kind = cfg.kind
    this.index = index
    this.panelAspect = panelAspect
    this.canvas = document.createElement('canvas')
    this.canvas.width = W
    this.canvas.height = H
    this.ctx = this.canvas.getContext('2d')!
    const tex = new THREE.CanvasTexture(this.canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    this.texture = tex
    paintPlaceholder(this.ctx, 0, index, cfg.kind)
    tex.needsUpdate = true
    if (cfg.src) void this.load(cfg.src, cfg.kind)
  }

  private cover(aspect: number) {
    const pa = this.panelAspect
    if (aspect > pa) {
      const r = pa / aspect
      this.crop.set(r, 1, (1 - r) / 2, 0)
    } else {
      const r = aspect / pa
      this.crop.set(1, r, 0, (1 - r) / 2)
    }
  }

  async load(src: string, kind: 'video' | 'photo', objectUrl = false): Promise<boolean> {
    const generation = ++this.generation
    let video: HTMLVideoElement | undefined
    let texture: THREE.Texture | undefined
    try {
      if (kind === 'video') {
        video = document.createElement('video')
        video.muted = true
        video.loop = true
        video.playsInline = true
        video.crossOrigin = 'anonymous'
        const v = video
        await new Promise<void>((resolve, reject) => {
          v.onloadedmetadata = () => resolve()
          v.onerror = () => reject(new Error('Video load failed'))
          v.src = src
          v.load()
        })
        if (this.disposed || generation !== this.generation) throw new Error('Cancelled')
        this.cover(v.videoWidth / v.videoHeight)
        texture = new THREE.VideoTexture(v)
      } else {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Image load failed'))
          img.src = src
        })
        if (this.disposed || generation !== this.generation) throw new Error('Cancelled')
        this.cover(img.width / img.height)
        texture = new THREE.Texture(img)
        texture.needsUpdate = true
        texture.anisotropy = 8
      }
      texture.colorSpace = THREE.SRGBColorSpace
      this.releaseMedia()
      this.video = video
      this.texture = texture
      this.objectUrl = objectUrl ? src : undefined
      this.kind = kind
      this.userMedia = true
      this.onTexture?.(texture)
      return true
    } catch {
      if (video) { video.pause(); video.removeAttribute('src'); video.load() }
      texture?.dispose()
      if (objectUrl) URL.revokeObjectURL(src)
      return false
    }
  }

  private releaseMedia() {
    if (this.video) {
      this.video.pause()
      this.video.removeAttribute('src')
      this.video.load()
      this.video = undefined
    }
    this.texture.dispose()
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    this.objectUrl = undefined
  }

  clear() {
    ++this.generation
    this.releaseMedia()
    this.kind = this.cfg.kind
    this.userMedia = false
    this.crop.set(1, 1, 0, 0)
    this.lastPaint = -1
    paintPlaceholder(this.ctx, 0, this.index, this.cfg.kind)
    const texture = new THREE.CanvasTexture(this.canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    this.texture = texture
    this.onTexture?.(texture)
  }

  dispose() {
    this.disposed = true
    ++this.generation
    this.releaseMedia()
    this.onTexture = undefined
  }

  onTexture?: (t: THREE.Texture) => void

  setActive(on: boolean) {
    const v = this.video
    if (!v) return
    if (on && v.paused) v.play().catch(() => {})
    if (!on && !v.paused) v.pause()
  }

  update(time: number, active: boolean) {
    if (this.userMedia) return
    if (!active) return
    // Обновляем плейсхолдеры с той же частотой, что и экспорт.
    const q = Math.floor(time * 60 + 1e-6)
    if (q === this.lastPaint) return
    this.lastPaint = q
    paintPlaceholder(this.ctx, time + this.index * 3.7, this.index, this.cfg.kind)
    this.texture.needsUpdate = true
  }
}
