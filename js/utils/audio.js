/**
 * utils/audio.js — hiệu ứng âm thanh tổng hợp bằng Web Audio (không cần file mp3).
 * Tổng 1 có thể tắt/bật bằng nút loa hoặc phím S.
 */
class AudioKit {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  tone({ freq = 440, to = null, dur = 0.15, type = 'sine', gain = 0.16, delay = 0 }) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), t0 + dur);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  hover() {
    this.tone({ freq: 660, dur: 0.05, type: 'triangle', gain: 0.03 });
  }

  click() {
    this.tone({ freq: 320, to: 520, dur: 0.09, type: 'triangle', gain: 0.1 });
  }

  next() {
    this.tone({ freq: 440, to: 720, dur: 0.18, type: 'sine', gain: 0.08 });
    this.tone({ freq: 880, dur: 0.1, type: 'sine', gain: 0.04, delay: 0.09 });
  }

  prev() {
    this.tone({ freq: 520, to: 330, dur: 0.18, type: 'sine', gain: 0.08 });
  }

  correct() {
    [523.25, 659.25, 783.99].forEach((freq, i) =>
      this.tone({ freq, dur: 0.16, type: 'sine', gain: 0.09, delay: i * 0.085 })
    );
  }

  wrong() {
    this.tone({ freq: 220, to: 130, dur: 0.3, type: 'sawtooth', gain: 0.06 });
    this.tone({ freq: 165, to: 98, dur: 0.34, type: 'triangle', gain: 0.07, delay: 0.05 });
  }

  finish() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
      this.tone({ freq, dur: 0.22, type: 'triangle', gain: 0.08, delay: i * 0.11 })
    );
  }

  error() {
    this.tone({ freq: 300, to: 180, dur: 0.16, type: 'square', gain: 0.04 });
  }
}

export const audio = new AudioKit();
