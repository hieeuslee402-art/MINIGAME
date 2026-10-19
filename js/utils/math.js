/**
 * utils/math.js — hình học & làm mượt tín hiệu bàn tay.
 */

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));

export const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const midpoint = (a, b) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: ((a.z || 0) + (b.z || 0)) / 2,
});

/** Bộ lọc EMA (exponential moving average) cho từng điểm mốc. */
export class LandmarkSmoother {
  constructor(alpha = 0.55) {
    this.alpha = alpha;
    this.prev = null;
  }

  reset() {
    this.prev = null;
  }

  smooth(landmarks) {
    if (!landmarks) return null;
    if (!this.prev || this.prev.length !== landmarks.length) {
      this.prev = landmarks.map((p) => ({ ...p }));
      return this.prev;
    }
    const a = this.alpha;
    this.prev = landmarks.map((p, i) => {
      const q = this.prev[i];
      return {
        x: q.x + (p.x - q.x) * a,
        y: q.y + (p.y - q.y) * a,
        z: (q.z || 0) + ((p.z || 0) - (q.z || 0)) * a,
      };
    });
    return this.prev;
  }
}

/**
 * Quy đổi toạ độ mốc (0..1, gốc trên-trái của khung hình gốc) sang pixel
 * của khung hình đang bị lật gương — dùng chung cho video preview & overlay.
 */
export function toScreenPoint(landmark, width, height) {
  return {
    x: (1 - landmark.x) * width,
    y: landmark.y * height,
    z: landmark.z,
  };
}
