import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { MediaSlot } from '../src/intro/media.ts'

test('visible video plays and follows the timeline, then pauses', async () => {
  let plays = 0, pauses = 0
  const video = {
    duration: 4, currentTime: 0, paused: true, seeking: false,
    play() { plays++; this.paused = false; return Promise.resolve() },
    pause() { pauses++; this.paused = true },
  }
  const slot = Object.create(MediaSlot.prototype) as MediaSlot
  slot.video = video as unknown as HTMLVideoElement
  slot.setActive(true, 2)
  assert.equal(video.currentTime, 2)
  assert.equal(plays, 1)
  await Promise.resolve()
  slot.setActive(true, 2.1)
  assert.equal(plays, 1)
  assert.equal(video.currentTime, 2)
  slot.setActive(false)
  assert.equal(pauses, 1)
})
