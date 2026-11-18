import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import { GoldIntro } from './engine'
import { brandReveal, frameTiming } from './timeline'
import logoUrl from '../assets/logo.svg?inline'
import { BRAND, END_T, FLASH_T } from './config'

const WIDTH = 1280
const HEIGHT = 720
const OUTPUT_WIDTH = 1920
const OUTPUT_HEIGHT = 1080
const FPS = 60
const frames = Math.round(END_T * FPS)
const cancelled = (signal: AbortSignal) => { if (signal.aborted) throw new DOMException('Экспорт отменён', 'AbortError') }
const yieldUI = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

// The interface lives in HTML during playback; draw its cinematic elements explicitly into the export.
function drawOverlay(ctx: CanvasRenderingContext2D, t: number, logo: HTMLImageElement) {
  ctx.save()
  const brand = brandReveal(t, FLASH_T)
  if (brand.visible) {
    ctx.save()
    ctx.globalAlpha = brand.backdrop
    ctx.translate(WIDTH * .5, HEIGHT * .49)
    ctx.scale(WIDTH * .49, HEIGHT * .42)
    const backdrop = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
    backdrop.addColorStop(0, 'rgba(5,4,3,.78)')
    backdrop.addColorStop(.52, 'rgba(5,4,3,.45)')
    backdrop.addColorStop(1, 'rgba(5,4,3,0)')
    ctx.fillStyle = backdrop
    ctx.fillRect(-2, -2, 4, 4)
    ctx.restore()
    ctx.save()
    ctx.globalAlpha = brand.markOpacity
    ctx.translate(WIDTH / 2, 290 + 70 * brand.centreOffset)
    ctx.scale(brand.markScale, brand.markScale)
    ctx.filter = `blur(${brand.blur / brand.markScale}px)`
    ctx.shadowColor = 'rgba(215,181,109,.6)'
    ctx.shadowBlur = brand.glow / brand.markScale
    ctx.drawImage(logo, -72, -76, 144, 152)
    ctx.restore()
    ctx.textAlign = 'center'
    ctx.globalAlpha = brand.text
    ctx.fillStyle = '#e7c98e'
    ctx.filter = `blur(${(1 - brand.text) * 5}px)`
    ctx.font = '600 55px "Cormorant Garamond", Georgia, serif'
    ctx.fillText(BRAND.name, WIDTH / 2, 438 + (1 - brand.text) * 14, WIDTH * .88)
  }
  ctx.restore()
}

export async function exportIntro(engine: GoldIntro, signal: AbortSignal, progress: (text: string) => void): Promise<Blob> {
  if (!('VideoEncoder' in window) || !('VideoFrame' in window)) {
    throw new Error('Экспорт требует браузер с поддержкой WebCodecs (рекомендуется актуальный Chrome или Edge).')
  }
  // Level 4.2 is required for 1080p60. Try high, main and baseline profiles.
  let videoConfig: VideoEncoderConfig | undefined
  for (const codec of ['avc1.64002a', 'avc1.4d002a', 'avc1.42002a']) {
    const candidate: VideoEncoderConfig = { codec, width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT, bitrate: 24_000_000, framerate: FPS, avc: { format: 'avc' } }
    if ((await VideoEncoder.isConfigSupported(candidate)).supported) { videoConfig = candidate; break }
  }
  if (!videoConfig) {
    throw new Error('Браузер или устройство не поддерживают экспорт H.264 в 1080p при 60 кадрах/с. Попробуйте актуальный Chrome или Edge на другом устройстве.')
  }
  cancelled(signal)
  progress('Подготовка кадров…')
  await yieldUI()
  cancelled(signal)
  await document.fonts.ready
  const logo = new Image()
  await new Promise<void>((resolve, reject) => {
    logo.onload = () => resolve()
    logo.onerror = () => reject(new Error('Не удалось загрузить логотип для экспорта.'))
    logo.src = logoUrl
  })
  cancelled(signal)
  const target = new ArrayBufferTarget()
  const muxer = new Muxer({ target, video: { codec: 'avc', width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT, frameRate: FPS }, fastStart: 'in-memory' })
  let failure: Error | undefined
  const encodedTimestamps = new Set<number>()
  let outputFrames = 0
  const videoEncoder = new VideoEncoder({ output: (chunk, meta) => {
    try {
      outputFrames++
      if (encodedTimestamps.has(chunk.timestamp)) throw new Error('Кодировщик создал повторный кадр.')
      encodedTimestamps.add(chunk.timestamp)
      muxer.addVideoChunk(chunk, meta)
    } catch (e) { failure = e as Error }
  }, error: (e) => { failure = e } })
  const check = () => { cancelled(signal); if (failure) throw failure }
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_WIDTH; canvas.height = OUTPUT_HEIGHT
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Не удалось создать поверхность для экспорта.')
  let begun = false
  try {
    videoEncoder.configure(videoConfig)
    engine.beginExport(OUTPUT_WIDTH, OUTPUT_HEIGHT); begun = true
    for (let i = 0; i < frames; i++) {
      check()
      const scene = await engine.renderExportFrame(i / FPS)
      check()
      ctx.drawImage(scene, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT)
      ctx.save()
      ctx.scale(OUTPUT_WIDTH / WIDTH, OUTPUT_HEIGHT / HEIGHT)
      drawOverlay(ctx, i / FPS, logo)
      ctx.restore()
      const frame = new VideoFrame(canvas, frameTiming(i, FPS))
      videoEncoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 }); frame.close()
      if (videoEncoder.encodeQueueSize > 6) await videoEncoder.flush()
      if (i % 30 === 0) { progress(`Экспорт кадров: ${i + 1} / ${frames}`); await yieldUI() }
    }
    await videoEncoder.flush(); check()
    if (outputFrames !== frames || Array.from({ length: frames }, (_, i) => frameTiming(i, FPS).timestamp).some((timestamp) => !encodedTimestamps.has(timestamp))) {
      throw new Error('Кодировщик пропустил или изменил кадры. MP4 не сохранён; попробуйте другой браузер или устройство.')
    }
    progress('Сборка MP4…')
    muxer.finalize()
    return new Blob([target.buffer], { type: 'video/mp4' })
  } finally {
    if (begun) engine.endExport()
    if (videoEncoder.state !== 'closed') videoEncoder.close()
  }
}
