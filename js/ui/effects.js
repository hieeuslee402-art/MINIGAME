/**
 * ui/effects.js — bong bóng hóa chất ở nền, pháo giấy khi trả lời đúng,
 * toast thông báo và nháy sáng màn hình.
 */
import { el } from '../utils/dom.js';

const PALETTE = ['#5ef2c0', '#a6ffd9', '#48c9ff', '#c8ff62', '#ffffff', '#7dfcd8'];

/* Biểu tượng SVG nhỏ cho toast — không dùng emoji để hiển thị giống nhau trên mọi máy. */
const svg = (inner, color = 'currentColor') =>
  `<svg viewBox="0 0 24 24" fill="none" style="width:15px;height:15px;color:${color}">${inner}</svg>`;

const TOAST_ICONS = {
  ok: svg('<path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>', '#5ef2c0'),
  bad: svg('<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="m9 9 6 6m0-6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', '#ff8a8a'),
  warn: svg('<path d="M12 4.5 21 19.5H3z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 10v4.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="currentColor"/>', '#ffcf6b'),
  hand: svg('<path d="M8.5 11V5.4a1.4 1.4 0 0 1 2.8 0V10m0 0V4.2a1.4 1.4 0 0 1 2.8 0V10m0 0V5.6a1.4 1.4 0 0 1 2.8 0v7.6c0 3.7-2.4 6.3-5.9 6.3-2 0-3.4-.7-4.5-2.4L5 13.9c-.5-.8-.3-1.8.5-2.3.7-.4 1.6-.2 2 .5l1 1.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>', '#5ef2c0'),
  arrow: svg('<path d="M4.5 12h14M13 6.5 18.5 12 13 17.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', '#a6ffd9'),
  flask: svg('<path d="M10 4h4m-3.4 0v7.4L5.9 19.2A2 2 0 0 0 7.6 22h8.8a2 2 0 0 0 1.7-2.8L13.4 11.4V4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 17.5h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>', '#5ef2c0'),
  cam: svg('<rect x="3" y="6.5" width="13" height="11" rx="2.4" stroke="currentColor" stroke-width="1.7"/><path d="m16 11.2 4.2-2.4v6.4L16 12.8z" fill="currentColor"/>', '#a6ffd9'),
  sound: svg('<path d="M4 9.5h3L12 6v12L7 14.5H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>', '#a6ffd9'),
  mute: svg('<path d="M4 9.5h3L12 6v12L7 14.5H4z" fill="currentColor"/><path d="m16 9.5 5 5m0-5-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>', '#a6ffd9'),
  brain: svg('<path d="M12 5.4a3 3 0 0 0-5.6 1.3A2.8 2.8 0 0 0 5 12a3 3 0 0 0 1.9 5.2A2.8 2.8 0 0 0 12 19zM12 5.4a3 3 0 0 1 5.6 1.3A2.8 2.8 0 0 1 19 12a3 3 0 0 1-1.9 5.2A2.8 2.8 0 0 1 12 19z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>', '#a6ffd9'),
  search: svg('<circle cx="10.5" cy="10.5" r="6" stroke="currentColor" stroke-width="1.8"/><path d="m15 15 4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', '#a6ffd9'),
  flag: svg('<path d="M6 21V4m0 0 10 2.4L6 9z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>', '#ffcf6b'),
  video: svg('<rect x="3" y="5" width="18" height="14" rx="2.6" stroke="currentColor" stroke-width="1.7"/><path d="m10.4 9.2 4.8 2.8-4.8 2.8z" fill="currentColor"/>', '#a6ffd9'),
  mouse: svg('<rect x="7" y="3" width="10" height="18" rx="5" stroke="currentColor" stroke-width="1.7"/><path d="M12 7v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>', '#a6ffd9'),
};

function iconFor(icon) {
  if (!icon) return TOAST_ICONS.flask;
  if (icon.startsWith('<svg')) return icon;
  return TOAST_ICONS[icon] || TOAST_ICONS.flask;
}

export class Effects {
  constructor({ bgCanvas, fxCanvas, flashEl, toastLayer }) {
    this.bgCanvas = bgCanvas;
    this.fxCanvas = fxCanvas;
    this.flashEl = flashEl;
    this.toastLayer = toastLayer;

    this.bgCtx = bgCanvas?.getContext('2d');
    this.fxCtx = fxCanvas?.getContext('2d');
    this.bubbles = [];
    this.sparks = [];
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.runningFx = false;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._lastT = performance.now();
    this._toasts = [];
  }

  init() {
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._seedBubbles();
    requestAnimationFrame((t) => this._bgLoop(t));
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    [this.bgCanvas, this.fxCanvas].forEach((canvas) => {
      if (!canvas) return;
      canvas.width = Math.floor(w * this.dpr);
      canvas.height = Math.floor(h * this.dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    });
    this.width = w;
    this.height = h;
  }

  /* ------------------------------------------------------------ bong bóng */
  _seedBubbles() {
    const count = window.innerWidth < 700 ? 24 : 46;
    this.bubbles = Array.from({ length: count }, () => this._newBubble(true));
  }

  _newBubble(initial = false) {
    const w = this.width || window.innerWidth;
    const h = this.height || window.innerHeight;
    const r = 1.6 + Math.random() * Math.random() * 9;
    return {
      x: Math.random() * w,
      y: initial ? Math.random() * h : h + r * 2,
      r,
      speed: 8 + Math.random() * 22 + r * 1.4,
      drift: (Math.random() - 0.5) * 10,
      phase: Math.random() * Math.PI * 2,
      wobble: 0.4 + Math.random(),
      alpha: 0.05 + Math.random() * 0.14,
    };
  }

  _bgLoop(now) {
    const dt = Math.min(50, now - this._lastT) / 1000;
    this._lastT = now;

    const ctx = this.bgCtx;
    if (ctx && !this.reduced) {
      const w = this.width;
      const h = this.height;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      this.bubbles.forEach((b) => {
        b.y -= b.speed * dt;
        b.phase += dt * b.wobble;
        b.x += Math.sin(b.phase) * b.drift * dt;
        if (b.y + b.r < -20) Object.assign(b, this._newBubble(false));

        const grad = ctx.createRadialGradient(
          b.x - b.r * 0.3,
          b.y - b.r * 0.3,
          b.r * 0.1,
          b.x,
          b.y,
          b.r
        );
        grad.addColorStop(0, `rgba(200, 255, 236, ${b.alpha * 1.3})`);
        grad.addColorStop(0.6, `rgba(94, 242, 192, ${b.alpha * 0.55})`);
        grad.addColorStop(1, `rgba(72, 201, 255, ${b.alpha * 0.15})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(166, 255, 217, ${b.alpha * 0.8})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.globalCompositeOperation = 'source-over';
    }
    requestAnimationFrame((t) => this._bgLoop(t));
  }

  /* -------------------------------------------------------------- pháo giấy */
  burst(kind = 'good') {
    if (this.reduced) return;
    const ctx = this.fxCtx;
    if (!ctx) return;
    const cx = this.width / 2;
    const cy = this.height * 0.62;
    const count = kind === 'good' ? 84 : 28;
    const colors = kind === 'good' ? PALETTE : ['#ff7a7a', '#ffb3b3', '#ffd1d1'];

    for (let i = 0; i < count; i += 1) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * (kind === 'good' ? 2.4 : 1.4);
      const speed = 240 + Math.random() * 620;
      this.sparks.push({
        x: cx + (Math.random() - 0.5) * 160,
        y: cy + (Math.random() - 0.5) * 50,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (kind === 'good' ? 120 : 0),
        size: 2 + Math.random() * (kind === 'good' ? 6 : 4),
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 10,
        life: 0,
        ttl: 1.1 + Math.random() * 0.9,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: Math.random() > 0.55 ? 'rect' : 'dot',
        gravity: 900,
      });
    }
    if (!this.runningFx) {
      this.runningFx = true;
      this._fxLast = performance.now();
      requestAnimationFrame((t) => this._fxLoop(t));
    }
  }

  _fxLoop(now) {
    const ctx = this.fxCtx;
    const dt = Math.min(40, now - this._fxLast) / 1000;
    this._fxLast = now;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    this.sparks = this.sparks.filter((p) => p.life < p.ttl);
    this.sparks.forEach((p) => {
      p.life += dt;
      p.vy += p.gravity * dt;
      p.vx *= 1 - 0.9 * dt;
      p.vy *= 1 - 0.25 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;

      const fade = Math.max(0, 1 - p.life / p.ttl);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    if (this.sparks.length) {
      requestAnimationFrame((t) => this._fxLoop(t));
    } else {
      ctx.clearRect(0, 0, this.width, this.height);
      this.runningFx = false;
    }
  }

  flash(type = 'good') {
    if (!this.flashEl) return;
    this.flashEl.classList.remove('is-good', 'is-bad');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add(type === 'good' ? 'is-good' : 'is-bad');
    clearTimeout(this.flashEl._timer);
    this.flashEl._timer = setTimeout(() => {
      this.flashEl.classList.remove('is-good', 'is-bad');
    }, 950);
  }

  /* ---------------------------------------------------------------- toast */
  toast(text, { icon = 'flask', type = '', duration = 2800 } = {}) {
    if (!this.toastLayer) return;
    const node = el('div', { class: `toast${type ? ` toast--${type}` : ''}`, role: 'status' });
    node.innerHTML = `<span class="toast__icon">${iconFor(icon)}</span><span>${text}</span>`;
    this.toastLayer.append(node);
    this._toasts.push(node);
    while (this._toasts.length > 3) {
      const old = this._toasts.shift();
      old.remove();
    }
    setTimeout(() => {
      node.classList.add('is-out');
      setTimeout(() => node.remove(), 380);
    }, duration);
  }

  clearToasts() {
    this._toasts.forEach((t) => t.remove());
    this._toasts = [];
  }
}
