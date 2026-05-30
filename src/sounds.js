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
  } catch (e) {}
}

export function playBuzzer() {
  try {
    unlockAudio()
    if (!audioCtx) return

    const ctx = audioCtx
    const resume = ctx.state !== 'running' ? ctx.resume() : Promise.resolve()

    resume.then(() => {
      try {
        const now = ctx.currentTime
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gain  = ctx.createGain()

        osc1.connect(gain)
        osc2.connect(gain)
        gain.connect(ctx.destination)

        osc1.type = 'sawtooth'
        osc1.frequency.setValueAtTime(220, now)
        osc1.frequency.setValueAtTime(200, now + 0.5)
        osc1.frequency.setValueAtTime(220, now + 1.0)
        osc1.frequency.setValueAtTime(200, now + 1.5)
        osc1.frequency.setValueAtTime(220, now + 2.0)

        osc2.type = 'square'
        osc2.frequency.value = 224

        gain.gain.setValueAtTime(0.3, now)
        gain.gain.setValueAtTime(0.3, now + 2.7)
        gain.gain.linearRampToValueAtTime(0, now + 3)

        osc1.start(now); osc1.stop(now + 3)
        osc2.start(now); osc2.stop(now + 3)
      } catch (e) { console.warn('doPlay failed:', e) }
    }).catch(e => console.warn('resume failed:', e))
  } catch (e) { console.warn('playBuzzer failed:', e) }
}
