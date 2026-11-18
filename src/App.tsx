import { useCallback, useEffect, useRef, useState } from 'react'
import { GoldIntro } from './intro/engine'
import { exportIntro } from './intro/export'
import { brandReveal } from './intro/timeline'
import logoUrl from './assets/logo.svg?inline'
import { BRAND, END_T, FLASH_T, MEDIA, clipCenter } from './intro/config'

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

type Status = 'idle' | 'playing' | 'paused' | 'ended'

const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`


export default function App() {
  const stageRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<GoldIntro | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const titleRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const logoWrap = useRef<HTMLDivElement>(null)
  const markRef = useRef<HTMLDivElement>(null)
  const logoBackdropRef = useRef<HTMLDivElement>(null)
  const tagRef = useRef<HTMLDivElement>(null)
  const hudRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLInputElement>(null)
  const timelineTimeRef = useRef<HTMLSpanElement>(null)

  const [status, setStatus] = useState<Status>('idle')
  const [dragging, setDragging] = useState(false)
  const [toast, setToast] = useState('')
  const [userCount, setUserCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exportProgress, setExportProgress] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [videoError, setVideoError] = useState(false)
  const videoUrlRef = useRef('')
  const exportRef = useRef<AbortController | null>(null)
  const loadingRef = useRef(false)
  const toastTimer = useRef<number | undefined>(undefined)

  const onFrame = useCallback((t: number) => {
    // вступительная надпись
    if (titleRef.current) {
      const a = smooth(0.9, 1.9, t) * (1 - smooth(3.0, 4.0, t))
      titleRef.current.style.opacity = String(a)
      titleRef.current.style.transform = `translateY(${(1 - smooth(0.9, 1.9, t)) * 14}px) scale(${1 + (t - 1) * 0.012})`
      titleRef.current.style.filter = `blur(${(1 - a) * 6}px)`
    }

    // прогресс
    if (barRef.current) barRef.current.style.transform = `scaleX(${clamp01(t / END_T)})`
    if (timelineRef.current) {
      timelineRef.current.value = String(t)
      timelineRef.current.style.setProperty('--progress', `${clamp01(t / END_T) * 100}%`)
      timelineRef.current.setAttribute('aria-valuetext', `${formatTime(t)} из ${formatTime(END_T)}`)
    }
    if (timelineTimeRef.current) timelineTimeRef.current.textContent = formatTime(t)
    if (hudRef.current) hudRef.current.style.opacity = String(smooth(1, 2, t) * (1 - smooth(FLASH_T - 0.8, FLASH_T - 0.2, t)))

    // Знак вырастает из центра вспышки и занимает место над подписью.
    const brand = brandReveal(t, FLASH_T)
    if (logoWrap.current) logoWrap.current.style.opacity = brand.visible ? '1' : '0'
    if (logoBackdropRef.current) logoBackdropRef.current.style.opacity = String(brand.backdrop)
    if (markRef.current && logoWrap.current) {
      const centreOffset = logoWrap.current.clientHeight / 2 - (markRef.current.offsetTop + markRef.current.offsetHeight / 2)
      markRef.current.style.opacity = String(brand.markOpacity)
      markRef.current.style.transform = `translateY(${centreOffset * brand.centreOffset}px) scale(${brand.markScale})`
      markRef.current.style.filter = `blur(${brand.blur}px) drop-shadow(0 0 ${brand.glow}px rgba(215,181,109,.6))`
    }
    if (tagRef.current) {
      tagRef.current.style.opacity = String(brand.text)
      tagRef.current.style.transform = `translateY(${(1 - brand.text) * 14}px)`
      tagRef.current.style.filter = `blur(${(1 - brand.text) * 5}px)`
    }
  }, [])

  useEffect(() => {
    if (!stageRef.current) return
    let eng: GoldIntro
    try {
      eng = new GoldIntro(stageRef.current)
    } catch {
      setError('Не удалось запустить 3D-графику. Проверьте поддержку WebGL в браузере.')
      return
    }
    engineRef.current = eng
    ;(window as unknown as { __intro?: GoldIntro }).__intro = eng
    eng.onFrame = onFrame
    eng.onEnd = () => setStatus('ended')
    eng.onVideoError = (message) => setError(message)
    loadingRef.current = true
    setLoading(true)
    void eng.loadDefaultMedia().then((count) => {
      if (engineRef.current !== eng) return
      setUserCount(count)
      loadingRef.current = false
      setLoading(false)
      if (count !== MEDIA.length) setError(`Не удалось загрузить видео: ${MEDIA.length - count} из ${MEDIA.length}. Проверьте доступность файлов или загрузите их вручную.`)
    })
    return () => {
      exportRef.current?.abort()
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
      eng.dispose()
      window.clearTimeout(toastTimer.current)
      if ((window as unknown as { __intro?: GoldIntro }).__intro === eng) delete (window as unknown as { __intro?: GoldIntro }).__intro
      engineRef.current = null
    }
  }, [onFrame])

  const play = () => {
    const eng = engineRef.current
    if (!eng || loadingRef.current || exportRef.current) return
    eng.start()
    setStatus('playing')
  }

  const togglePlayback = () => {
    const eng = engineRef.current
    if (!eng || exportRef.current) return
    if (eng.playing) {
      eng.pause()
      setStatus('paused')
    } else {
      eng.resume()
      setStatus('playing')
    }
  }

  const seekTimeline = (time: number) => {
    const eng = engineRef.current
    if (!eng || exportRef.current) return
    eng.seek(time)
    setStatus('paused')
  }

  const addFiles = useCallback(async (files: File[]) => {
    const eng = engineRef.current
    if (!eng || !files.length || loadingRef.current || exportRef.current || videoUrlRef.current) return
    loadingRef.current = true
    setLoading(true)
    const result = await eng.assignFiles(files)
    if (engineRef.current !== eng) { loadingRef.current = false; return }
    setUserCount(eng.userMediaCount)
    const message = [`Добавлено: ${result.loaded}`, result.failed ? `ошибок: ${result.failed}` : '', result.skipped ? `нет свободных слотов: ${result.skipped}` : ''].filter(Boolean).join(' · ')
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 4000)
    loadingRef.current = false
    setLoading(false)
  }, [])

  const clearFiles = () => {
    if (loadingRef.current || exportRef.current) return
    engineRef.current?.clearFiles()
    setUserCount(0)
    setToast('Слоты очищены')
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }

  const exportVideo = async () => {
    const eng = engineRef.current
    if (!eng || loadingRef.current || exportRef.current) return
    const controller = new AbortController()
    exportRef.current = controller
    setError('')
    setExportProgress('Подготовка экспорта…')
    try {
      const blob = await exportIntro(eng, controller.signal, setExportProgress)
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(blob)
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
      videoUrlRef.current = url
      eng.setVideoPreview(true)
      setVideoError(false)
      setVideoUrl(url)
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : 'Не удалось экспортировать видео.')
    } finally {
      if (exportRef.current === controller) { exportRef.current = null; setExportProgress('') }
    }
  }

  const closeVideo = () => {
    engineRef.current?.setVideoPreview(false)
    setVideoUrl('')
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
    videoUrlRef.current = ''
  }

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
        <div className="absolute top-6 left-6 flex items-center gap-3 text-[10px] tracking-[0.35em] uppercase text-[#e9d8b6]/80 md:top-8 md:left-10">
          <img src={logoUrl} alt="" className="h-6 w-6 object-contain" />
          {BRAND.name}
        </div>
        <div className="absolute top-6 left-1/2 hidden -translate-x-1/2 text-[10px] tracking-[0.4em] uppercase text-[#e8c27a]/60 md:top-8 md:block">
          A CINEMATIC EXPERIENCE
        </div>



      </div>

      {/* прогресс */}
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-[2px] bg-white/5">
        <div ref={barRef} className="h-full origin-left bg-gradient-to-r from-[#8a6126] via-[#f3d58f] to-[#fff6dc]" style={{ transform: 'scaleX(0)' }} />
      </div>

      {/* Фирменный знак и подпись */}
      <div ref={logoWrap} className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center opacity-0">
        <div ref={logoBackdropRef} className="brand-backdrop absolute inset-0 opacity-0" />
        <div ref={markRef} className="relative mb-6 h-32 w-32 opacity-0 md:mb-9 md:h-48 md:w-48">
          <img src={logoUrl} alt="" className="h-full w-full object-contain" />
        </div>
        <div ref={tagRef} className="gold-text relative max-w-[90vw] px-3 text-center text-[clamp(25px,4.6vw,64px)] leading-tight tracking-[0.08em] opacity-0" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontWeight: 600 }}>
          {BRAND.name}
        </div>
      </div>

      {/* Стартовый экран */}
      {status === 'idle' && (
        <div className="intro-cover absolute inset-0 z-20 flex flex-col items-center justify-center overflow-y-auto px-6 py-12 text-center">
          <div className="cover-frame pointer-events-none absolute inset-4 md:inset-7" />
          <div className="cover-top pointer-events-none absolute left-8 right-8 top-8 flex items-center justify-between md:left-12 md:right-12 md:top-11">
            <span>{BRAND.name} <span className="cover-top-muted"> / CREATIVE STUDIO</span></span>
            <span className="cover-top-muted">EST. 2026</span>
          </div>
          <div className="relative flex w-full max-w-3xl flex-col items-center pt-10">
            <div className="mb-7 h-14 w-14 opacity-90 md:mb-9 md:h-20 md:w-20"><img src={logoUrl} alt="Логотип Янтарный циркуль" className="h-full w-full object-contain" /></div>
            <div className="cover-eyebrow">A CINEMATIC EXPERIENCE <span>✦</span> BY {BRAND.name}</div>
            <h1 className="cover-heading mt-5 md:mt-7">История, достойная<br /><em>золотого света.</em></h1>
            <div className="cover-divider mt-7 md:mt-9"><span /></div>
            <p className="cover-description mt-6">Десять моментов. Одно впечатление.<br />Создайте интро, которое останется в памяти.</p>
            <button disabled={loading} onClick={play} className="cover-button group mt-8 md:mt-10">
              <span className="cover-play">▶</span><span>Смотреть интро</span><span className="cover-arrow">↗</span>
            </button>
            <button disabled={loading} onClick={() => fileRef.current?.click()} className="cover-upload mt-6">
              {loading ? 'Загрузка медиа…' : 'Добавить свои фото и видео'} {userCount > 0 ? `· ${userCount}/10` : ''}
            </button>
            <div className="cover-hint mt-2">или просто перетащите файлы в окно</div>
            <button disabled={loading} onClick={exportVideo} className="cover-export mt-5">↓ &nbsp; Экспортировать MP4 <span>1080p · 60 fps</span></button>
            {userCount > 0 && <button disabled={loading} onClick={clearFiles} className="mt-3 text-xs text-[#e8c27a]/70 underline">Очистить слоты</button>}
          </div>
          <div className="cover-bottom pointer-events-none absolute bottom-9 left-10 right-10 hidden items-center justify-between md:flex">
            <span>THE ART OF FIRST IMPRESSIONS</span><span>01 — 10</span><span>A STUDY IN LIGHT AND MOTION</span>
          </div>
        </div>
      )}

      {(status === 'playing' || status === 'paused') && (
        <button disabled={loading} onClick={exportVideo} className="absolute top-6 right-6 z-30 border border-[#d8c5a3]/35 bg-black/40 px-4 py-2 text-[10px] tracking-[0.15em] uppercase text-[#e8d4a6] backdrop-blur hover:border-[#d8c5a3] md:top-8 md:right-10">
          Экспорт MP4
        </button>
      )}

      {/* конец */}
      {status === 'ended' && (
        <div className="absolute right-0 bottom-28 left-0 z-20 flex flex-col items-center gap-3">
          <div className="flex items-center gap-6">
            <button onClick={play} className="border border-[#e8c27a]/60 bg-black/30 px-7 py-3 text-[11px] tracking-[0.45em] text-[#fff1cc] uppercase backdrop-blur transition hover:border-[#fff1cc] hover:bg-[#e8c27a]/10">
              Повторить
            </button>
            <button disabled={loading} onClick={() => fileRef.current?.click()} className="text-[11px] tracking-[0.3em] text-[#e8c27a]/70 uppercase underline-offset-4 hover:text-[#fff1cc] hover:underline">
              Загрузить медиа {userCount > 0 ? `· ${userCount}/10` : ''}
            </button>
          </div>
          <button disabled={loading} onClick={exportVideo} className="cover-export">↓ &nbsp; Экспортировать MP4 <span>1080p · 60 fps</span></button>
          {userCount > 0 && <button disabled={loading} onClick={clearFiles} className="text-xs text-[#e8c27a]/70 underline">Очистить слоты</button>}
        </div>
      )}

      {status !== 'idle' && (
        <div className="timeline-controls absolute bottom-4 left-1/2 z-30 w-[min(94vw,760px)] -translate-x-1/2 px-4 py-3 md:bottom-6 md:px-6" aria-label="Управление таймлайном">
          <div className="flex items-center gap-3 md:gap-5">
            <button onClick={togglePlayback} className="timeline-play" aria-label={status === 'playing' ? 'Пауза' : 'Воспроизвести'} title={status === 'playing' ? 'Пауза' : 'Воспроизвести'}>{status === 'playing' ? 'Ⅱ' : '▶'}</button>
            <span ref={timelineTimeRef} className="timeline-time">00:00</span>
            <div className="min-w-0 flex-1">
              <input ref={timelineRef} className="timeline-range" type="range" min="0" max={END_T} step={1 / 60} defaultValue="0" aria-label="Позиция анимации" onChange={(event) => seekTimeline(Number(event.currentTarget.value))} />
              <div className="timeline-markers" aria-label="Переход к кадру">
                {MEDIA.map((item, i) => <button key={`${item.title}-${i}`} style={{ left: `${(clipCenter(i) / END_T) * 100}%` }} onClick={() => seekTimeline(clipCenter(i))} aria-label={`Кадр ${i + 1}: ${item.title}`} title={`${String(i + 1).padStart(2, '0')} · ${item.title}`}><span /></button>)}
              </div>
            </div>
            <span className="timeline-time">{formatTime(END_T)}</span>
            <button onClick={play} className="timeline-restart" aria-label="С начала" title="С начала">↺</button>
          </div>
        </div>
      )}

      {exportProgress && <div role="status" className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-black/90 px-6 text-center">
        <div className="text-xs tracking-[0.3em] uppercase text-[#d8c5a3]">Создаём ваше видео</div>
        <p className="text-sm text-[#e8d4a6]/75">{exportProgress}</p>
        <p className="max-w-sm text-xs leading-relaxed text-[#e8d4a6]/45">Кадры рассчитываются последовательно. Не закрывайте вкладку — экспорт может занять несколько минут.</p>
        <button onClick={() => exportRef.current?.abort()} className="border border-[#d8c5a3]/50 px-6 py-3 text-xs text-[#e8d4a6]">Отменить</button>
      </div>}

      {videoUrl && <div role="dialog" aria-modal="true" aria-label="Готовое видео" className="absolute inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-[#080807] px-4 py-6 md:px-10">
        <div className="flex w-full max-w-6xl items-center justify-between gap-4 text-[#e8d4a6]">
          <div><div className="text-xs tracking-[0.25em] uppercase">Ваше видео готово</div><div className="mt-1 text-[11px] text-[#e8d4a6]/50">Full HD · 60 кадров/с · без звука</div></div>
          <button onClick={closeVideo} className="border border-[#d8c5a3]/40 px-4 py-2 text-xs hover:border-[#d8c5a3]">Закрыть</button>
        </div>
        <video src={videoUrl} controls playsInline muted autoPlay className="min-h-0 w-full max-w-6xl flex-1 object-contain" onError={() => setVideoError(true)} />
        {videoError && <p role="alert" className="text-sm text-[#e8d4a6]">Не удалось воспроизвести MP4 в браузере. Попробуйте скачать файл.</p>}
        <a href={videoUrl} download="yantarny-tsirkul-intro-1080p-60fps.mp4" className="border border-[#d8c5a3]/60 px-7 py-3 text-xs tracking-[0.2em] uppercase text-[#e8d4a6] hover:bg-[#e8d4a6]/10">Скачать MP4</a>
      </div>}

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

      {error && <div role="alert" className="absolute top-12 left-1/2 z-50 w-[min(90%,36rem)] -translate-x-1/2 border border-[#e8c27a]/50 bg-black/90 p-4 text-center text-sm">{error}</div>}

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
