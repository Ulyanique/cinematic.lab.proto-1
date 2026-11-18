import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { brandBackdropOpacity, brandReveal, clipMediaTime, continuousCameraTime, finaleDim, frameTiming, lightOrbit, lightPanelIndex, lightVisibility } from '../src/intro/timeline.ts'
import { CLIP_DT, CLIP_T0, END_T, FLASH_T, MEDIA, PANEL_BEFORE, PANEL_AFTER, clipCenter } from '../src/intro/config.ts'

test('60 fps timestamps are contiguous through the complete export', () => {
  const total = Math.round(END_T * 60)
  let end = 0
  for (let i = 0; i < total; i++) {
    const frame = frameTiming(i, 60)
    assert.equal(frame.timestamp, end)
    assert.ok(frame.duration > 0)
    end = frame.timestamp + frame.duration
  }
  assert.equal(end, Math.round(END_T * 1_000_000))
})


test('every panel has time to finish before the finale', () => {
  assert.ok(CLIP_DT >= 3 && CLIP_DT <= 4)
  assert.ok(clipCenter(MEDIA.length - 1) + PANEL_AFTER < FLASH_T)
})


test('camera keeps moving forward with smooth velocity through every panel', () => {
  const last = clipCenter(MEDIA.length - 1)
  const path = (t: number) => continuousCameraTime(t, CLIP_T0, last, CLIP_DT, FLASH_T)
  const step = 1 / 60
  let previousSpeed = 0
  for (let t = CLIP_T0 - 2; t < FLASH_T - step; t += step) {
    const speed = (path(t + step) - path(t)) / step
    assert.ok(speed > 0.05, `camera stopped or reversed at ${t}: ${speed}`)
    if (previousSpeed) assert.ok(Math.abs(speed - previousSpeed) < 0.1, `velocity jumped at ${t}`)
    previousSpeed = speed
  }
  for (let i = 0; i < MEDIA.length; i++) {
    const t = clipCenter(i)
    assert.ok(path(t + step) > path(t))
  }
})


test('light follows a smooth circle outside the entire card', () => {
  const width = 10.4, height = 5.85, step = 1 / 600
  const radius = Math.hypot(width / 2, height / 2) + 1.5
  let previousVelocity: { x: number, y: number } | undefined
  for (let t = 0; t < 2.7; t += step) {
    const a = lightOrbit(t, 0, 0, width, height)
    const b = lightOrbit(t + step, 0, 0, width, height)
    assert.ok(Math.abs(Math.hypot(a.x, a.y) - radius) < 1e-10)
    assert.ok(Math.abs(a.x) > width / 2 || Math.abs(a.y) > height / 2)
    const velocity = { x: (b.x - a.x) / step, y: (b.y - a.y) / step }
    if (previousVelocity) assert.ok(Math.hypot(velocity.x - previousVelocity.x, velocity.y - previousVelocity.y) < 0.5)
    previousVelocity = velocity
  }
})

test('the beam is invisible when it switches between panels', () => {
  const count = MEDIA.length
  for (let i = 0; i < count - 1; i++) {
    const boundary = clipCenter(i) + CLIP_DT / 2
    assert.ok(lightVisibility(boundary, CLIP_T0, CLIP_DT, count, PANEL_BEFORE, PANEL_AFTER) < 1e-12)
    assert.equal(lightPanelIndex(boundary - 0.001, CLIP_T0, CLIP_DT, count), i)
    assert.equal(lightPanelIndex(boundary + 0.001, CLIP_T0, CLIP_DT, count), i + 1)
    assert.ok(lightVisibility(boundary - 0.46, CLIP_T0, CLIP_DT, count, PANEL_BEFORE, PANEL_AFTER) > 0.99)
    assert.ok(lightVisibility(boundary + 0.46, CLIP_T0, CLIP_DT, count, PANEL_BEFORE, PANEL_AFTER) > 0.99)
  }
})


test('preview and export can seek the same looping source time', () => {
  assert.equal(clipMediaTime(0, 4.6, 2.4, 3), 0)
  assert.ok(Math.abs(clipMediaTime(4.6, 4.6, 2.4, 3) - 2.4) < 1e-9)
  assert.ok(Math.abs(clipMediaTime(6.2, 4.6, 2.4, 3) - 1) < 1e-9)
  assert.equal(clipMediaTime(8, 4.6, 2.4, Infinity), 0)
})


test('finale clears the stage smoothly before the final logo settles', () => {
  assert.equal(finaleDim(FLASH_T, FLASH_T), 0)
  assert.ok(finaleDim(FLASH_T + 3, FLASH_T) > 0)
  assert.equal(finaleDim(FLASH_T + 5, FLASH_T), 0.78)
  assert.equal(brandBackdropOpacity(0), 0)
  assert.equal(brandBackdropOpacity(1), 1)
  for (let p = 0; p < 1; p += 0.01) assert.ok(brandBackdropOpacity(p + 0.01) >= brandBackdropOpacity(p))
})


test('brand emerges from the explosion before the text and settles in place', () => {
  assert.equal(brandReveal(FLASH_T, FLASH_T).visible, false)
  const early = brandReveal(FLASH_T + 0.5, FLASH_T)
  assert.equal(early.visible, true)
  assert.ok(early.markOpacity > 0 && early.markScale < 0.5 && early.centreOffset > 0.8)
  assert.equal(early.text, 0)
  const final = brandReveal(FLASH_T + 4, FLASH_T)
  assert.equal(final.markOpacity, 1)
  assert.equal(final.markScale, 1)
  assert.equal(final.centreOffset, 0)
  assert.equal(final.text, 1)
  assert.equal(final.backdrop, 1)
})
