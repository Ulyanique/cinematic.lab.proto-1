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
  name: 'ЯНТАРНЫЙ ЦИРКУЛЬ',
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
export const CLIP_DT = 3.7 // время на один кадр
export const clipCenter = (i: number) => CLIP_T0 + i * CLIP_DT
export const FLASH_T = clipCenter(MEDIA.length - 1) + 4.4
export const END_T = FLASH_T + 9.5

// Общее окно видимости для живой сцены и покадрового экспорта.
export const PANEL_BEFORE = 2.4
export const PANEL_AFTER = 2.2
