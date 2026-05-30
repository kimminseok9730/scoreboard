let audioCtx = null

export function unlockAudio() {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      audioCtx = new AC()
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
  } catch (e) {
    // silent fail (iframe sandbox 등)
  }
}

function doPlay(ctx) {
  try {
    const now = ctx.currentTime

    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()

    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(ctx.destination)

    osc1.type = 'sawtooth'
    osc1.frequency.setValueAtTime(220, now)
    osc1.frequency.setValueAtTime(200, now + 0.6)
    osc1.frequency.setValueAtTime(220, now + 1.2)
    osc1.frequency.setValueAtTime(200, now + 1.8)
    osc1.frequency.setValueAtTime(220, now + 2.4)

    osc2.type = 'square'
    osc2.frequency.setValueAtTime(224, now)

    gain.gain.setValueAtTime(0.3, now)
    gain.gain.setValueAtTime(0.3, now + 2.7)
    gain.gain.linearRampToValueAtTime(0, now + 3)

    osc1.start(now); osc1.stop(now + 3)
    osc2.start(now); osc2.stop(now + 3)
  } catch (e) {
    console.warn('Buzzer play failed:', e)
  }
}

export function playBuzzer() {
  try {
    unlockAudio()
    if (!audioCtx) return

    if (audioCtx.state === 'running') {
      doPlay(audioCtx)
    } else {
      // resume은 비동기 — then()으로 재생
      audioCtx.resume().then(() => doPlay(audioCtx)).catch(() => {})
    }
  } catch (e) {
    console.warn('Buzzer failed:', e)
  }
}
