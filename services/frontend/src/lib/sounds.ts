type SoundType = 'bid' | 'won' | 'settled'

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (audioCtx && audioCtx.state !== 'closed') {
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
      return audioCtx
    }
    type ExtWindow = Window & { webkitAudioContext?: typeof AudioContext }
    const Ctor = window.AudioContext ?? (window as ExtWindow).webkitAudioContext
    if (!Ctor) return null
    audioCtx = new Ctor()
    return audioCtx
  } catch {
    return null
  }
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  gainAmount = 0.3,
  delay = 0
): void {
  const osc      = ctx.createOscillator()
  const gainNode = ctx.createGain()
  osc.connect(gainNode)
  gainNode.connect(ctx.destination)
  osc.type = type
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay)
  gainNode.gain.setValueAtTime(0, ctx.currentTime + delay)
  gainNode.gain.linearRampToValueAtTime(gainAmount, ctx.currentTime + delay + 0.01)
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration)
  osc.start(ctx.currentTime + delay)
  osc.stop(ctx.currentTime + delay + duration)
}

const SOUNDS: Record<SoundType, (ctx: AudioContext) => void> = {
  bid: ctx => {
    playTone(ctx, 440, 0.12, 'sine', 0.25, 0)
    playTone(ctx, 550, 0.12, 'sine', 0.25, 0.15)
  },
  won: ctx => {
    playTone(ctx, 523, 0.4, 'sine', 0.3,  0)
    playTone(ctx, 659, 0.4, 'sine', 0.25, 0.1)
    playTone(ctx, 784, 0.6, 'sine', 0.35, 0.2)
  },
  settled: ctx => {
    playTone(ctx, 880, 0.2, 'sine', 0.3,  0)
    playTone(ctx, 660, 0.35, 'sine', 0.25, 0.2)
  },
}

export function playSound(type: SoundType): void {
  const ctx = getAudioContext()
  if (!ctx) return
  try { SOUNDS[type](ctx) } catch { /* audio blocked by browser policy */ }
}

export function vibrate(pattern: number | number[]): void {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return
  try { navigator.vibrate(pattern) } catch { /* not supported */ }
}

export const notificationFeedback = {
  bid:     () => { playSound('bid');     vibrate([50]) },
  won:     () => { playSound('won');     vibrate([100, 50, 100, 50, 200]) },
  settled: () => { playSound('settled'); vibrate([80, 40, 80]) },
}
