import { useCallback, useEffect, useRef, useState } from 'react'
import { GoldIntro } from './intro/engine'
import { IntroAudio } from './intro/audio'
import { BRAND, END_T, FLASH_T, LOGO_T, MEDIA, clipCenter } from './intro/config'

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3)

type Status = 'idle' | 'playing' | 'ended'

function StarMark({ progress }: { progress: number }) {
  // 8-лучевая звезда, рисуется по контуру
  const pts: string[] = []
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 === 0 ? 46 : 11
    pts.push(`${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`)
  }
  const d = 'M' + pts.join('L') + 'Z'
  const dash = 420
  const draw = easeOut(progress / 0.7)
  const fill = smooth(0.55, 1, progress)
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
      <defs>
        <linearGradient id="gstar" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff4cf" />
          <stop offset="0.5" stopColor="#e9b95a" />
          <stop offset="1" stopColor="#9a6a22" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="none" stroke="url(#gstar)" strokeWidth="0.6" strokeDasharray="302" strokeDashoffset={302 * (1 - draw)} opacity="0.8" />
      <path d={d} fill="url(#gstar)" fillOpacity={fill} stroke="url(#gstar)" strokeWidth="1" strokeDasharray={dash} strokeDashoffset={dash * (1 - draw)} strokeLinejoin="round" />
      <circle cx="50" cy="50" r="3.2" fill="#fff" opacity={fill} />
    </svg>
  )
}

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<GoldIntro | null>(null)
  const audioRef = useRef<IntroAudio>(new IntroAudio())
  const fileRef = useRef<HTMLInputElement>(null)

  const titleRef = useRef<HTMLDivElement>(null)
  const capRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const logoWrap = useRef<HTMLDivElement>(null)
  const letters = useRef<(HTMLSpanElement | null)[]>([])
  const markRef = useRef<HTMLDivElement>(null)
  const tagRef = useRef<HTMLDivElement>(null)
  const rulesRef = useRef<HTMLDivElement>(null)
  const sheenRef = useRef<HTMLDivElement>(null)
  const tickRefs = useRef<(HTMLDivElement | null)[]>([])
  const hudRef = useRef<HTMLDivElement>(null)

  const [status, setStatus] = useState<Status>('idle')
  const [clip, setClip] = useState(-1)
  const [markP, setMarkP] = useState(0)
  const [muted, setMuted] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [toast, setToast] = useState('')
  const [userCount, setUserCount] = useState(0)
  const clipRef = useRef(-1)
  const markPRef = useRef(0)

  const onFrame = useCallback((t: number) => {
    // вступительная надпись
    if (titleRef.current) {
      const a = smooth(0.9, 1.9, t) * (1 - smooth(3.0, 4.0, t))
      titleRef.current.style.opacity = String(a)
      titleRef.current.style.transform = `translateY(${(1 - smooth(0.9, 1.9, t)) * 14}px) scale(${1 + (t - 1) * 0.012})`
      titleRef.current.style.filter = `blur(${(1 - a) * 6}px)`
    }

    // подписи клипов
    let idx = -1
    let cw = 0
    for (let i = 0; i < MEDIA.length; i++) {
      const tc = clipCenter(i)
      if (t > tc - 2.0 && t < tc + 1.2) {
        idx = i
        cw = smooth(tc - 2.0, tc - 1.3, t) * (1 - smooth(tc + 0.5, tc + 1.2, t))
      }
    }
    if (idx !== clipRef.current) {
      clipRef.current = idx
      setClip(idx)
    }
    if (capRef.current) {
      capRef.current.style.opacity = String(cw)
      capRef.current.style.transform = `translateX(${(1 - cw) * -24}px)`
    }

    // прогресс
    if (barRef.current) barRef.current.style.transform = `scaleX(${clamp01(t / END_T)})`
    tickRefs.current.forEach((el, i) => {
      if (!el) return
      const tc = clipCenter(i)
      const on = smooth(tc - 1.5, tc - 0.8, t)
      el.style.opacity = String(0.22 + 0.78 * on)
      el.style.transform = `scaleY(${1 + (idx === i ? 1.2 : 0)})`
    })
    if (hudRef.current) hudRef.current.style.opacity = String(smooth(1, 2, t) * (1 - smooth(FLASH_T - 0.8, FLASH_T - 0.2, t)))

    // логотип
    const lp = clamp01((t - LOGO_T) / 3)
    if (logoWrap.current) {
      logoWrap.current.style.opacity = lp > 0 ? '1' : '0'
      const n = letters.current.length
      letters.current.forEach((el, i) => {
        if (!el) return
        const k = easeOut((lp - i * 0.07) / 0.55)
        el.style.opacity = String(k)
        el.style.transform = `translateY(${(1 - k) * 26}px) scale(${1 + (1 - k) * 0.25})`
        el.style.filter = `blur(${(1 - k) * 14}px)`
        el.style.letterSpacing = '0'
        void n
      })
      if (markRef.current) {
        markRef.current.style.opacity = String(smooth(0, 0.3, lp))
        markRef.current.style.transform = `scale(${0.7 + 0.3 * easeOut(lp / 0.8)}) rotate(${(1 - easeOut(lp / 0.9)) * -40}deg)`
      }
      if (tagRef.current) {
        const k = easeOut((lp - 0.45) / 0.55)
        tagRef.current.style.opacity = String(k)
        tagRef.current.style.letterSpacing = `${0.9 - 0.45 * k}em`
        tagRef.current.style.filter = `blur(${(1 - k) * 8}px)`
      }
      if (rulesRef.current) {
        const k = easeOut((lp - 0.35) / 0.6)
        rulesRef.current.style.transform = `scaleX(${k})`
        rulesRef.current.style.opacity = String(k)
      }
      if (sheenRef.current) {
        const sp = ((t - LOGO_T - 1.6) / 2.2) % 3.2
        sheenRef.current.style.backgroundPosition = `${200 - sp * 140}% 0`
      }
    }
    const mp = clamp01((t - LOGO_T) / 1.6)
    if (Math.abs(mp - markPRef.current) > 0.01 || (mp === 0) !== (markPRef.current === 0)) {
      markPRef.current = mp
      setMarkP(mp)
    }
  }, [])

  useEffect(() => {
    if (!stageRef.current) return
    const eng = new GoldIntro(stageRef.current)
    engineRef.current = eng
    ;(window as unknown as { __intro?: GoldIntro }).__intro = eng
    eng.onFrame = onFrame
    eng.onEnd = () => setStatus('ended')
    const audio = audioRef.current
    return () => {
      eng.dispose()
      audio.stop()
      engineRef.current = null
    }
  }, [onFrame])

  const play = () => {
    const eng = engineRef.current
    if (!eng) return
    audioRef.current.start(0)
    eng.start()
    setStatus('playing')
  }

  const toggleMute = () => {
    const m = !muted
    setMuted(m)
    audioRef.current.setMuted(m)
  }

  const addFiles = useCallback((files: File[]) => {
    const eng = engineRef.current
    if (!eng || !files.length) return
    eng.assignFiles(files)
    const n = eng.userMediaCount
    setUserCount(n)
    setToast(`Загружено в слоты: ${n} из 10`)
    window.setTimeout(() => setToast(''), 2600)
  }, [])

  useEffect(() => {
    const over = (e: DragEvent) => {
      e.preventDefault()
      setDragging(true)
    }
    const leave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragging(false)
    }
    const drop = (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      addFiles(Array.from(e.dataTransfer?.files ?? []))
    }
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [addFiles])

  const cur = clip >= 0 ? MEDIA[clip] : null

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-[#f4e3b8] select-none" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
      <div ref={stageRef} className="absolute inset-0" />

      {/* вступительная надпись */}
      <div ref={titleRef} className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center opacity-0">
        <div className="text-[11px] tracking-[0.6em] text-[#d8b36a]/80 uppercase md:text-xs">{BRAND.name}</div>
        <div className="mt-4 h-px w-24 bg-gradient-to-r from-transparent via-[#e8c27a] to-transparent" />
        <div className="gold-text mt-4 text-3xl italic md:text-5xl" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          {BRAND.presents}
        </div>
      </div>

      {/* HUD */}
      <div ref={hudRef} className="pointer-events-none absolute inset-0 opacity-0">
        <div className="absolute top-6 left-6 flex items-center gap-3 text-[10px] tracking-[0.4em] uppercase text-[#e8c27a]/80 md:top-8 md:left-10">
          <span className="inline-block h-1.5 w-1.5 rotate-45 bg-[#e8c27a]" />
          {BRAND.name}
        </div>
        <div className="absolute top-6 right-6 text-[10px] tracking-[0.4em] uppercase text-[#e8c27a]/60 md:top-8 md:right-10">
          Golden Intro · 2026
        </div>

        <div ref={capRef} className="absolute bottom-24 left-6 md:bottom-28 md:left-10" style={{ opacity: 0 }}>
          <div className="flex items-end gap-4">
            <div className="gold-text text-6xl leading-none md:text-8xl" style={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 600 }}>
              {String(clip + 1).padStart(2, '0')}
            </div>
            <div className="pb-1 md:pb-3">
              <div className="text-[10px] tracking-[0.45em] text-[#e8c27a]/70 uppercase">
                {cur ? (cur.kind === 'video' ? 'Видео' : 'Фото') : ''} · {clip + 1} / 10
              </div>
              <div className="mt-1 text-xl tracking-[0.2em] text-[#fff1cc] uppercase md:text-2xl" style={{ fontFamily: 'Cinzel, serif' }}>
                {cur?.title}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 items-end gap-2 md:bottom-12">
          {MEDIA.map((_, i) => (
            <div
              key={i}
              ref={(el) => {
                tickRefs.current[i] = el
              }}
              className="h-3 w-[3px] origin-bottom bg-[#e8c27a] transition-transform duration-300"
              style={{ opacity: 0.22 }}
            />
          ))}
        </div>
      </div>

      {/* прогресс */}
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-[2px] bg-white/5">
        <div ref={barRef} className="h-full origin-left bg-gradient-to-r from-[#8a6126] via-[#f3d58f] to-[#fff6dc]" style={{ transform: 'scaleX(0)' }} />
      </div>

      {/* логотип */}
      <div ref={logoWrap} className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center opacity-0">
        <div ref={markRef} className="mb-5 h-16 w-16 md:mb-7 md:h-24 md:w-24" style={{ filter: 'drop-shadow(0 0 18px rgba(255,200,100,.55))' }}>
          <StarMark progress={markP} />
        </div>
        <div className="relative">
          <div className="flex" style={{ fontFamily: 'Cinzel, serif', fontWeight: 600 }}>
            {BRAND.name.split('').map((ch, i) => (
              <span
                key={i}
                ref={(el) => {
                  letters.current[i] = el
                }}
                className="gold-letter inline-block text-[clamp(52px,11vw,170px)] leading-none"
                style={{ opacity: 0, margin: '0 0.04em' }}
              >
                {ch}
              </span>
            ))}
          </div>
          <div
            ref={sheenRef}
            className="sheen absolute inset-0"
            style={{ fontFamily: 'Cinzel, serif', fontWeight: 600 }}
          >
            <div className="flex">
              {BRAND.name.split('').map((ch, i) => (
                <span key={i} className="inline-block text-[clamp(52px,11vw,170px)] leading-none" style={{ margin: '0 0.04em' }}>
                  {ch}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div ref={rulesRef} className="my-4 h-px w-[min(520px,70vw)] origin-center bg-gradient-to-r from-transparent via-[#f0cf88] to-transparent md:my-6" style={{ opacity: 0 }} />
        <div ref={tagRef} className="text-[11px] tracking-[0.5em] text-[#f1d596] uppercase md:text-sm" style={{ opacity: 0 }}>
          {BRAND.tagline}
        </div>
      </div>

      {/* стартовый экран */}
      {status === 'idle' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/55 backdrop-blur-[3px]">
          <div className="mb-8 h-16 w-16 opacity-90">
            <StarMark progress={1} />
          </div>
          <div className="text-[11px] tracking-[0.6em] text-[#e8c27a]/80 uppercase">{BRAND.name} · Golden Intro</div>
          <h1 className="gold-text mt-5 px-6 text-center text-4xl leading-tight md:text-6xl" style={{ fontFamily: '"Cormorant Garamond", serif', fontWeight: 600 }}>
            10 кадров. Одна звезда.
          </h1>
          <p className="mt-4 max-w-md px-6 text-center text-sm leading-relaxed text-[#e8d4a6]/70">
            Золотые полигоны, стеклянные панели и взрыв звезды. Включите звук для полного эффекта.
          </p>
          <button
            onClick={play}
            className="group relative mt-10 overflow-hidden border border-[#e8c27a]/70 px-10 py-4 text-xs tracking-[0.5em] text-[#fff1cc] uppercase transition hover:border-[#fff1cc]"
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#e8c27a]/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative">Запустить интро</span>
          </button>
          <button onClick={() => fileRef.current?.click()} className="mt-6 text-[11px] tracking-[0.3em] text-[#e8c27a]/60 uppercase underline-offset-4 hover:text-[#fff1cc] hover:underline">
            Загрузить своё фото / видео {userCount > 0 ? `· ${userCount}/10` : ''}
          </button>
          <div className="mt-3 text-[11px] text-[#e8d4a6]/40">или перетащите файлы на окно — они займут 10 слотов по порядку</div>
        </div>
      )}

      {/* конец */}
      {status === 'ended' && (
        <div className="absolute right-0 bottom-8 left-0 z-20 flex flex-col items-center gap-3">
          <div className="flex items-center gap-6">
            <button onClick={play} className="border border-[#e8c27a]/60 bg-black/30 px-7 py-3 text-[11px] tracking-[0.45em] text-[#fff1cc] uppercase backdrop-blur transition hover:border-[#fff1cc] hover:bg-[#e8c27a]/10">
              Повторить
            </button>
            <button onClick={() => fileRef.current?.click()} className="text-[11px] tracking-[0.3em] text-[#e8c27a]/70 uppercase underline-offset-4 hover:text-[#fff1cc] hover:underline">
              Загрузить медиа {userCount > 0 ? `· ${userCount}/10` : ''}
            </button>
          </div>
        </div>
      )}

      {/* звук */}
      <button
        onClick={toggleMute}
        className="absolute top-5 right-1/2 z-30 translate-x-1/2 text-[10px] tracking-[0.35em] text-[#e8c27a]/60 uppercase hover:text-[#fff1cc] md:top-7"
        style={{ display: status === 'idle' ? 'none' : 'block' }}
      >
        {muted ? 'Звук выкл' : 'Звук вкл'}
      </button>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />

      {/* drag overlay */}
      {dragging && (
        <div className="pointer-events-none absolute inset-4 z-40 flex items-center justify-center border border-dashed border-[#e8c27a] bg-[#e8c27a]/10 backdrop-blur-sm">
          <div className="text-sm tracking-[0.5em] text-[#fff1cc] uppercase">Отпустите, чтобы заполнить слоты</div>
        </div>
      )}
      {toast && (
        <div className="absolute top-16 left-1/2 z-40 -translate-x-1/2 border border-[#e8c27a]/50 bg-black/70 px-5 py-2 text-[11px] tracking-[0.3em] text-[#fff1cc] uppercase backdrop-blur">
          {toast}
        </div>
      )}
    </div>
  )
}
