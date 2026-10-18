/**
 * ui/handOverlay.js
 * Vẽ khung xương bàn tay lên khung camera nhỏ, kèm vòng sáng khi ngón cái
 * chạm ngón trỏ / ngón giữa để người trình chiếu biết cử chỉ đã được nhận.
 */
import { CONFIG } from '../config.js';
import { dist } from '../utils/math.js';

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const flushingStroke = (flashing, color) =>
  flashing ? `rgba(255, 255, 255, 0.9)` : `rgba(${color}, 0.85)`;

const FINGER_COLOR = {
  thumb: 'rgba(255, 207, 107, 0.95)',
  index: 'rgba(72, 201, 255, 0.95)',
  middle: 'rgba(200, 255, 98, 0.95)',
  other: 'rgba(94, 242, 192, 0.72)',
};

export class HandOverlay {
  constructor(tracker, canvas) {
    this.tracker = tracker;
    this.canvas = canvas;
    this.ctx = canvas?.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.running = false;
    this.phase = 0;
    this._lastDraw = 0;
    this.chords = { ratios: {}, active: {}, winner: null };
    this.flash = {};
  }

  /** Nhận trạng thái các cặp ngón đang chạm từ GestureEngine. */
  setPinchState(state) {
    if (!state) return;
    this.chords = state;
  }

  /** Nháy sáng khi một cặp ngón vừa được nhận (A/B/C/D/NEXT). */
  pulse(action) {
    if (!action) return;
    this.flash[action] = performance.now();
  }

  start() {
    if (!this.ctx || this.running) return;
    this.running = true;
    requestAnimationFrame((t) => this._loop(t));
  }

  stop() {
    this.running = false;
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  _resize() {
    const canvas = this.canvas;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== w * this.dpr || canvas.height !== h * this.dpr) {
      canvas.width = w * this.dpr;
      canvas.height = h * this.dpr;
    }
    return { w, h };
  }

  _coverRect(vw, vh, cw, ch) {
    if (!vw || !vh) return { x: 0, y: 0, w: cw, h: ch };
    const scale = Math.max(cw / vw, ch / vh);
    const w = vw * scale;
    const h = vh * scale;
    return { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
  }

  _loop(now) {
    if (!this.running) return;
    if (now - this._lastDraw > 30) {
      this._draw(now);
      this._lastDraw = now;
    }
    requestAnimationFrame((t) => this._loop(t));
  }

  /** Vẽ khung xương của một bàn tay. dim < 1 → mờ hơn (tay phụ). */
  _drawSkeleton(ctx, landmarks, rect, dim = 1) {
    const pts = landmarks.map((lm) => ({
      x: rect.x + (1 - lm.x) * rect.w,
      y: rect.y + lm.y * rect.h,
    }));

    const chainOf = (a, b) => {
      if (a <= 4 && b <= 4) return 'thumb';
      if (a >= 5 && b <= 8) return 'index';
      if (a >= 9 && b <= 12) return 'middle';
      return 'other';
    };

    ctx.lineCap = 'round';
    CONNECTIONS.forEach(([a, b]) => {
      ctx.strokeStyle = FINGER_COLOR[chainOf(a, b)];
      ctx.lineWidth = a === 0 || b === 0 ? 1.6 : 1.3;
      ctx.globalAlpha = 0.85 * dim;
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.stroke();
    });

    ctx.globalAlpha = dim;
    pts.forEach((p, i) => {
      const isTip = [4, 8, 12, 16, 20].includes(i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, isTip ? 2.6 : 1.7, 0, Math.PI * 2);
      ctx.fillStyle = isTip ? 'rgba(240, 255, 250, 0.95)' : 'rgba(4, 26, 21, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(94, 242, 192, 0.85)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  _draw(now) {
    const ctx = this.ctx;
    if (!ctx) return;
    const { w, h } = this._resize();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const landmarks = this.tracker.lastLandmarks;
    const fresh = now - this.tracker.lastSeenAt < 650;
    this.phase = (this.phase + 0.04) % (Math.PI * 2);

    if (!landmarks || !fresh) {
      this._drawSearching(ctx, w, h, now);
      return;
    }

    const video = document.getElementById('video');
    const rect = this._coverRect(video?.videoWidth, video?.videoHeight, w, h);
    const pts = landmarks.map((lm) => ({
      x: rect.x + (1 - lm.x) * rect.w,
      y: rect.y + lm.y * rect.h,
    }));

    this._drawSkeleton(ctx, landmarks, rect, 1);

    // Tay còn lại (nếu có): vẽ mờ để thấy web nhận cả 2 tay
    (this.tracker.detectedHands || []).forEach((h) => {
      if (h.landmarks !== landmarks) this._drawSkeleton(ctx, h.landmarks, rect, 0.45);
    });

    // vòng sáng khi chạm ngón
    const size = Math.max(0.02, dist(landmarks[0], landmarks[9]));
    // --- vẽ 5 cặp ngón: cái+trỏ (A), cái+giữa (B), cái+áp út (C), cái+út (D), trỏ+giữa (NEXT)
    const CHORD_DRAW = [
      { action: 'A', a: 4, b: 8, color: '72, 201, 255' },
      { action: 'B', a: 4, b: 12, color: '200, 255, 98' },
      { action: 'C', a: 4, b: 16, color: '255, 207, 107' },
      { action: 'D', a: 4, b: 20, color: '255, 138, 180' },
      { action: 'NEXT', a: 8, b: 12, color: '166, 255, 217' },
    ];

    CHORD_DRAW.forEach(({ action, a, b, color }) => {
      const isNext = action === 'NEXT';
      const ratio = dist(landmarks[a], landmarks[b]) / size;
      const touching = this.chords.active?.[action];
      const flashAt = this.flash[action] || 0;
      const flashing = now - flashAt < 360;
      if (!touching && !flashing) return;

      const mid = { x: (pts[a].x + pts[b].x) / 2, y: (pts[a].y + pts[b].y) / 2 };
      // Cử chỉ chuyển trang là tư thế tay (không phải chạm) → vòng sáng cố định
      const closeness = isNext ? 0.55 : 1 - Math.min(1, ratio / CONFIG.gestures.chord.touchOff);
      const baseR = 10 + closeness * 10;

      // đoạn nối sáng giữa 2 đầu ngón
      ctx.strokeStyle = `rgba(${color}, 0.9)`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.stroke();

      // quầng sáng tại điểm chạm
      const grad = ctx.createRadialGradient(mid.x, mid.y, 0, mid.x, mid.y, baseR + 6);
      grad.addColorStop(0, `rgba(${color}, 0.4)`);
      grad.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(mid.x, mid.y, baseR + 6, 0, Math.PI * 2);
      ctx.fill();

      // vòng tròn nhấp nháy theo nhịp
      ctx.strokeStyle = `rgba(${color}, 0.95)`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(mid.x, mid.y, baseR + Math.sin(this.phase) * 2, 0, Math.PI * 2);
      ctx.stroke();

      // hiệu ứng lan toả khi vừa nhận
      if (flashing) {
        const k = 1 - (now - flashAt) / 360;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 * k})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mid.x, mid.y, baseR + 8 + (1 - k) * 18, 0, Math.PI * 2);
        ctx.stroke();
      }

      // nhãn hành động
      ctx.font = '700 9px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = `rgba(${color}, 0.95)`;
      ctx.fillText(action === 'NEXT' ? 'CÂU TIẾP' : action, mid.x + 12, mid.y - 8);
    });

    // nhãn tay
    ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = 'rgba(166, 255, 217, 0.85)';
    const bothHands = this.tracker.stats?.twoHandsUp;
    ctx.fillText(
      bothHands
        ? '2 TAY → CÂU TIẾP'
        : this.tracker.detectedLabel === 'Right'
        ? 'TAY PHẢI'
        : this.tracker.detectedLabel === 'Left'
        ? 'TAY TRÁI'
        : 'BÀN TAY',
      10,
      h - 10
    );
  }

  _drawSearching(ctx, w, h, now) {
    const pad = 8;
    const len = Math.min(w, h) * 0.16;
    ctx.strokeStyle = `rgba(94, 242, 192, ${0.35 + Math.sin(now / 500) * 0.15})`;
    ctx.lineWidth = 1.6;
    [
      [pad, pad, 1, 1],
      [w - pad, pad, -1, 1],
      [pad, h - pad, 1, -1],
      [w - pad, h - pad, -1, -1],
    ].forEach(([x, y, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(x, y + sy * len);
      ctx.lineTo(x, y);
      ctx.lineTo(x + sx * len, y);
      ctx.stroke();
    });

    ctx.font = '600 8.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = 'rgba(166, 255, 217, 0.55)';
    ctx.textAlign = 'center';
    ctx.fillText('ĐƯA TAY VÀO KHUNG HÌNH', w / 2, h - 10);
    ctx.textAlign = 'start';
  }
}
