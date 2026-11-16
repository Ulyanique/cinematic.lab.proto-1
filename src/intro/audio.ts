import { FLASH_T, LOGO_T, clipCenter } from './config'

/** Небольшой синтезатор звука для интро (WebAudio, без файлов). */
export class IntroAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  muted = false

  private ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AC()
    }
    return this.ctx
  }

  private noiseBuffer(ctx: AudioContext, sec: number) {
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return b
  }

  private reverb(ctx: AudioContext) {
    const len = ctx.sampleRate * 3.2
    const b = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6)
    }
    const conv = ctx.createConvolver()
    conv.buffer = b
    return conv
  }

  stop() {
    if (this.master && this.ctx) {
      const t = this.ctx.currentTime
      this.master.gain.cancelScheduledValues(t)
      this.master.gain.setTargetAtTime(0, t, 0.05)
      const m = this.master
      setTimeout(() => m.disconnect(), 400)
    }
    this.master = null
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.08)
  }

  /** startAt — время (сек) таймлайна, с которого начинаем играть */
  start(startAt = 0) {
    this.stop()
    const ctx = this.ensure()
    if (ctx.state === 'suspended') ctx.resume()
    const T0 = ctx.currentTime + 0.05 - startAt
    const at = (t: number) => Math.max(T0 + t, ctx.currentTime)

    const master = ctx.createGain()
    master.gain.value = this.muted ? 0 : 0.9
    const comp = ctx.createDynamicsCompressor()
    master.connect(comp)
    comp.connect(ctx.destination)
    this.master = master

    const rev = this.reverb(ctx)
    const revGain = ctx.createGain()
    revGain.gain.value = 0.55
    rev.connect(revGain)
    revGain.connect(master)
    const dry = ctx.createGain()
    dry.gain.value = 1
    dry.connect(master)
    const send = (n: AudioNode, wet = 0.6) => {
      n.connect(dry)
      const g = ctx.createGain()
      g.gain.value = wet
      n.connect(g)
      g.connect(rev)
    }

    const noise = this.noiseBuffer(ctx, 4)

    // ── дрон ──
    const droneGain = ctx.createGain()
    droneGain.gain.setValueAtTime(0, at(0))
    droneGain.gain.linearRampToValueAtTime(0.16, at(3))
    droneGain.gain.setValueAtTime(0.16, at(FLASH_T - 0.5))
    droneGain.gain.linearRampToValueAtTime(0, at(FLASH_T + 0.1))
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(180, at(0))
    lp.frequency.exponentialRampToValueAtTime(1400, at(FLASH_T - 1))
    lp.Q.value = 3
    lp.connect(droneGain)
    send(droneGain, 0.5)
    for (const [f, det] of [
      [55, 0],
      [55, 7],
      [82.4, -5],
      [110, 4],
    ] as const) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.detune.value = det
      o.connect(lp)
      o.start(at(0))
      o.stop(at(FLASH_T + 0.2))
    }

    // ── вступительный свист ──
    const whoosh = (t: number, dur: number, f0: number, f1: number, vol: number) => {
      const s = ctx.createBufferSource()
      s.buffer = noise
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 2.2
      bp.frequency.setValueAtTime(f0, at(t))
      bp.frequency.exponentialRampToValueAtTime(f1, at(t + dur))
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, at(t))
      g.gain.exponentialRampToValueAtTime(vol, at(t + dur * 0.45))
      g.gain.exponentialRampToValueAtTime(0.0001, at(t + dur))
      s.connect(bp)
      bp.connect(g)
      send(g, 0.4)
      s.start(at(t), Math.random() * 0.5)
      s.stop(at(t + dur + 0.1))
    }
    whoosh(0.4, 3.8, 300, 4200, 0.35)

    // ── клипы: свуш + «звон» ──
    const scale = [329.6, 392, 440, 493.9, 587.3, 659.3, 784, 880, 987.8, 1174.7]
    for (let i = 0; i < 10; i++) {
      const tc = clipCenter(i)
      whoosh(tc - 1.5, 1.4, 500 + (i % 2) * 400, 3200 + i * 150, 0.28)
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = scale[i]
      const o2 = ctx.createOscillator()
      o2.type = 'triangle'
      o2.frequency.value = scale[i] * 2.005
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, at(tc - 1.0))
      g.gain.exponentialRampToValueAtTime(0.16, at(tc - 0.95))
      g.gain.exponentialRampToValueAtTime(0.0001, at(tc + 1.8))
      o.connect(g)
      o2.connect(g)
      send(g, 0.9)
      o.start(at(tc - 1.0))
      o2.start(at(tc - 1.0))
      o.stop(at(tc + 1.9))
      o2.stop(at(tc + 1.9))
      // тихий низкий «удар»
      const k = ctx.createOscillator()
      k.type = 'sine'
      k.frequency.setValueAtTime(110, at(tc - 1.0))
      k.frequency.exponentialRampToValueAtTime(40, at(tc - 0.6))
      const kg = ctx.createGain()
      kg.gain.setValueAtTime(0.0001, at(tc - 1.0))
      kg.gain.exponentialRampToValueAtTime(0.35, at(tc - 0.98))
      kg.gain.exponentialRampToValueAtTime(0.0001, at(tc - 0.5))
      k.connect(kg)
      kg.connect(master)
      k.start(at(tc - 1.0))
      k.stop(at(tc - 0.4))
    }

    // ── подъём к взрыву ──
    const riseStart = FLASH_T - 5
    const rs = ctx.createBufferSource()
    rs.buffer = noise
    rs.loop = true
    const rhp = ctx.createBiquadFilter()
    rhp.type = 'highpass'
    rhp.frequency.setValueAtTime(300, at(riseStart))
    rhp.frequency.exponentialRampToValueAtTime(7000, at(FLASH_T))
    const rg = ctx.createGain()
    rg.gain.setValueAtTime(0.0001, at(riseStart))
    rg.gain.exponentialRampToValueAtTime(0.5, at(FLASH_T - 0.05))
    rg.gain.linearRampToValueAtTime(0, at(FLASH_T + 0.05))
    rs.connect(rhp)
    rhp.connect(rg)
    send(rg, 0.3)
    rs.start(at(riseStart))
    rs.stop(at(FLASH_T + 0.1))

    const sw = ctx.createOscillator()
    sw.type = 'sawtooth'
    sw.frequency.setValueAtTime(110, at(riseStart))
    sw.frequency.exponentialRampToValueAtTime(1760, at(FLASH_T))
    const swf = ctx.createBiquadFilter()
    swf.type = 'lowpass'
    swf.frequency.value = 2500
    const swg = ctx.createGain()
    swg.gain.setValueAtTime(0.0001, at(riseStart))
    swg.gain.exponentialRampToValueAtTime(0.14, at(FLASH_T - 0.1))
    swg.gain.linearRampToValueAtTime(0, at(FLASH_T + 0.05))
    sw.connect(swf)
    swf.connect(swg)
    send(swg, 0.5)
    sw.start(at(riseStart))
    sw.stop(at(FLASH_T + 0.1))

    // ── БУМ ──
    const boom = ctx.createOscillator()
    boom.type = 'sine'
    boom.frequency.setValueAtTime(120, at(FLASH_T))
    boom.frequency.exponentialRampToValueAtTime(28, at(FLASH_T + 1.6))
    const bg = ctx.createGain()
    bg.gain.setValueAtTime(0.0001, at(FLASH_T))
    bg.gain.exponentialRampToValueAtTime(1.0, at(FLASH_T + 0.02))
    bg.gain.exponentialRampToValueAtTime(0.0001, at(FLASH_T + 3.2))
    boom.connect(bg)
    bg.connect(master)
    boom.start(at(FLASH_T))
    boom.stop(at(FLASH_T + 3.3))

    const bn = ctx.createBufferSource()
    bn.buffer = noise
    const blp = ctx.createBiquadFilter()
    blp.type = 'lowpass'
    blp.frequency.setValueAtTime(9000, at(FLASH_T))
    blp.frequency.exponentialRampToValueAtTime(300, at(FLASH_T + 2.2))
    const bng = ctx.createGain()
    bng.gain.setValueAtTime(0.0001, at(FLASH_T))
    bng.gain.exponentialRampToValueAtTime(0.9, at(FLASH_T + 0.015))
    bng.gain.exponentialRampToValueAtTime(0.0001, at(FLASH_T + 2.6))
    bn.connect(blp)
    blp.connect(bng)
    send(bng, 0.7)
    bn.start(at(FLASH_T))
    bn.stop(at(FLASH_T + 2.8))

    // ── искры после взрыва ──
    for (let i = 0; i < 26; i++) {
      const t = FLASH_T + 0.15 + Math.pow(Math.random(), 1.6) * 3.5
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = 1500 + Math.random() * 3800
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, at(t))
      g.gain.exponentialRampToValueAtTime(0.05 * (1 - (t - FLASH_T) / 4), at(t + 0.005))
      g.gain.exponentialRampToValueAtTime(0.0001, at(t + 0.35))
      o.connect(g)
      send(g, 0.8)
      o.start(at(t))
      o.stop(at(t + 0.4))
    }

    // ── финальный аккорд (лого) ──
    const chord = [110, 164.8, 220, 329.6, 440, 554.4]
    const pg = ctx.createGain()
    pg.gain.setValueAtTime(0, at(FLASH_T + 0.4))
    pg.gain.linearRampToValueAtTime(0.2, at(LOGO_T + 1.5))
    pg.gain.linearRampToValueAtTime(0, at(LOGO_T + 8))
    send(pg, 0.8)
    chord.forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = i < 2 ? 'sawtooth' : 'sine'
      o.frequency.value = f
      o.detune.value = (i - 3) * 3
      const lf = ctx.createBiquadFilter()
      lf.type = 'lowpass'
      lf.frequency.value = i < 2 ? 500 : 3000
      o.connect(lf)
      lf.connect(pg)
      o.start(at(FLASH_T + 0.4))
      o.stop(at(LOGO_T + 8.1))
    })

  }
}
