import * as THREE from 'three'
import type { MediaSlotConfig } from './config'

const W = 960
const H = 540

const PALETTES: [string, string, string][] = [
  ['#2b3a4a', '#d98c3f', '#f4d9a0'],
  ['#1f3b34', '#c9a24a', '#f2e3b3'],
  ['#3a2a22', '#e0803a', '#ffd9a0'],
  ['#222a3a', '#7aa0c8', '#f1e4c0'],
  ['#33301f', '#d6b24a', '#fff0b8'],
  ['#2a2230', '#c47a4f', '#f6d6b0'],
  ['#18323a', '#58a6a0', '#f0e2b0'],
  ['#3b2b17', '#f0b34a', '#fff3c9'],
  ['#202020', '#b89a5a', '#efe3c4'],
  ['#2e2630', '#d99a52', '#ffe6b6'],
]

function paintPlaceholder(
  ctx: CanvasRenderingContext2D,
  t: number,
  i: number,
  kind: 'video' | 'photo',
  title: string,
) {
  const [c0, c1, c2] = PALETTES[i % PALETTES.length]
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, c0)
  g.addColorStop(1, '#0b0805')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // движущиеся световые пятна
  ctx.globalCompositeOperation = 'lighter'
  for (let k = 0; k < 4; k++) {
    const sp = kind === 'video' ? 0.55 : 0.18
    const x = W * (0.5 + 0.42 * Math.sin(t * sp + k * 1.9 + i))
    const y = H * (0.5 + 0.38 * Math.cos(t * sp * 0.8 + k * 2.3 + i * 0.7))
    const r = 220 + 90 * Math.sin(t * 0.7 + k)
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r)
    rg.addColorStop(0, k % 2 ? c1 + '70' : c2 + '30')
    rg.addColorStop(1, '#00000000')
    ctx.fillStyle = rg
    ctx.fillRect(0, 0, W, H)
  }
  ctx.globalCompositeOperation = 'source-over'

  // силуэт горизонта (параллакс)
  for (let layer = 0; layer < 3; layer++) {
    ctx.beginPath()
    ctx.moveTo(0, H)
    const off = t * (8 + layer * 14) * (kind === 'video' ? 1 : 0.2)
    for (let x = 0; x <= W; x += 24) {
      const y =
        H * (0.72 + layer * 0.07) -
        (40 - layer * 9) * Math.abs(Math.sin((x + off) * 0.006 + i * 3 + layer * 2)) -
        14 * Math.sin((x + off) * 0.021 + layer)
      ctx.lineTo(x, y)
    }
    ctx.lineTo(W, H)
    ctx.closePath()
    ctx.fillStyle = `rgba(8,6,4,${0.35 + layer * 0.22})`
    ctx.fill()
  }

  // сетка
  ctx.strokeStyle = 'rgba(255,230,170,0.07)'
  ctx.lineWidth = 1
  for (let x = 0; x <= W; x += 80) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let y = 0; y <= H; y += 80) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }

  // диагональ-блик
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.rotate(-0.5)
  const sx = ((t * 160 + i * 140) % (W * 2)) - W
  const sg = ctx.createLinearGradient(sx - 120, 0, sx + 120, 0)
  sg.addColorStop(0, '#fff0')
  sg.addColorStop(0.5, '#ffeec433')
  sg.addColorStop(1, '#fff0')
  ctx.fillStyle = sg
  ctx.fillRect(-W, -H, W * 2, H * 2)
  ctx.restore()

  // огромный номер
  ctx.font = '800 330px "Cormorant Garamond", Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255,235,190,0.28)'
  ctx.strokeText(String(i + 1).padStart(2, '0'), W / 2, H / 2 + 10)

  // иконка по центру
  const cx = W / 2
  const cy = H / 2
  ctx.fillStyle = 'rgba(0,0,0,0.38)'
  ctx.beginPath()
  ctx.arc(cx, cy, 58, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,240,200,0.9)'
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,244,214,0.95)'
  if (kind === 'video') {
    ctx.beginPath()
    ctx.moveTo(cx - 14, cy - 24)
    ctx.lineTo(cx + 28, cy)
    ctx.lineTo(cx - 14, cy + 24)
    ctx.closePath()
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.moveTo(cx - 30, cy + 20)
    ctx.lineTo(cx - 8, cy - 8)
    ctx.lineTo(cx + 6, cy + 10)
    ctx.lineTo(cx + 16, cy - 2)
    ctx.lineTo(cx + 32, cy + 20)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx + 14, cy - 18, 6, 0, Math.PI * 2)
    ctx.fill()
  }

  // уголки видоискателя
  ctx.strokeStyle = 'rgba(255,240,200,0.8)'
  ctx.lineWidth = 3
  const m = 34
  const L = 46
  const corners: [number, number, number, number][] = [
    [m, m, 1, 1],
    [W - m, m, -1, 1],
    [m, H - m, 1, -1],
    [W - m, H - m, -1, -1],
  ]
  for (const [x, y, dx, dy] of corners) {
    ctx.beginPath()
    ctx.moveTo(x + dx * L, y)
    ctx.lineTo(x, y)
    ctx.lineTo(x, y + dy * L)
    ctx.stroke()
  }

  // подписи
  ctx.font = '600 22px "Manrope", Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,240,205,0.92)'
  ctx.fillText(kind === 'video' ? 'VIDEO · PLACEHOLDER' : 'PHOTO · PLACEHOLDER', m + 6, H - m - 20)
  ctx.textAlign = 'right'
  ctx.fillText(title.toUpperCase(), W - m - 6, H - m - 20)
  ctx.textAlign = 'left'
  if (kind === 'video') {
    const sec = t % 60
    const tc = `00:${String(Math.floor(sec)).padStart(2, '0')}:${String(Math.floor((sec % 1) * 25)).padStart(2, '0')}`
    ctx.fillText(tc, m + 34, m + 30)
    ctx.fillStyle = Math.floor(t * 2) % 2 ? '#ff4d3a' : '#7a1f17'
    ctx.beginPath()
    ctx.arc(m + 14, m + 22, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,240,200,0.25)'
    ctx.fillRect(m + 6, H - m - 6, W - m * 2 - 12, 3)
    ctx.fillStyle = '#ffd98a'
    ctx.fillRect(m + 6, H - m - 6, (W - m * 2 - 12) * ((t * 0.12) % 1), 3)
  } else {
    ctx.fillText('RAW · 6000 × 3375', m + 6, m + 30)
  }

  // строчная развёртка + шум
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1)
  if (kind === 'video') {
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    const ny = (t * 220) % H
    ctx.fillRect(0, ny, W, 26)
  }
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

  constructor(cfg: MediaSlotConfig, index: number, panelAspect: number) {
    this.cfg = cfg
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
    paintPlaceholder(this.ctx, 0, index, cfg.kind, cfg.title)
    tex.needsUpdate = true
    if (cfg.src) this.load(cfg.src, cfg.kind)
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

  load(src: string, kind: 'video' | 'photo') {
    this.userMedia = true
    const old = this.texture
    if (kind === 'video') {
      const v = document.createElement('video')
      v.src = src
      v.muted = true
      v.loop = true
      v.playsInline = true
      v.crossOrigin = 'anonymous'
      v.addEventListener('loadedmetadata', () => this.cover(v.videoWidth / v.videoHeight))
      const vt = new THREE.VideoTexture(v)
      vt.colorSpace = THREE.SRGBColorSpace
      this.video = v
      this.texture = vt
    } else {
      const img = new THREE.TextureLoader().load(src, (t) => {
        const im = t.image as HTMLImageElement
        this.cover(im.width / im.height)
      })
      img.colorSpace = THREE.SRGBColorSpace
      img.anisotropy = 8
      this.texture = img
    }
    this.onTexture?.(this.texture)
    old.dispose()
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
    // ~30 fps для плейсхолдеров
    const q = Math.floor(time * 30)
    if (q === this.lastPaint) return
    this.lastPaint = q
    paintPlaceholder(this.ctx, time + this.index * 3.7, this.index, this.cfg.kind, this.cfg.title)
    this.texture.needsUpdate = true
  }
}
