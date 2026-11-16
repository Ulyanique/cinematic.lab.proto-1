// ───────────────────────────────────────────────────────────
//  Конфигурация золотого интро
//  Замените src на путь к вашему фото/видео (или просто перетащите
//  файлы на окно во время просмотра — они займут слоты по порядку).
// ───────────────────────────────────────────────────────────

export type MediaKind = 'video' | 'photo'

export interface MediaSlotConfig {
  kind: MediaKind
  title: string
  /** URL файла (необязательно). Если не задан — рисуется анимированный плейсхолдер */
  src?: string
}

export const BRAND = {
  name: 'AURUM',
  tagline: 'Золотой стандарт',
  presents: 'представляет',
}

export const MEDIA: MediaSlotConfig[] = [
  { kind: 'video', title: 'Рассвет' },
  { kind: 'photo', title: 'Энергия' },
  { kind: 'video', title: 'Люди' },
  { kind: 'photo', title: 'Мощь' },
  { kind: 'video', title: 'Движение' },
  { kind: 'photo', title: 'Город' },
  { kind: 'video', title: 'Технологии' },
  { kind: 'photo', title: 'Свет' },
  { kind: 'video', title: 'Будущее' },
  { kind: 'photo', title: 'Единство' },
]

// ── Таймлайн (секунды) ──
export const CLIP_T0 = 4.6 // центр первого клипа
export const CLIP_DT = 2.8 // шаг между клипами
export const FLASH_T = 35.2 // момент вспышки / взрыва звезды
export const LOGO_T = FLASH_T + 1.5
export const END_T = FLASH_T + 9.5

export const clipCenter = (i: number) => CLIP_T0 + i * CLIP_DT
