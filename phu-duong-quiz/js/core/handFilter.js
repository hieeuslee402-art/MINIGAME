/**
 * core/handFilter.js
 * Lọc kết quả MediaPipe: loại các "bàn tay ảo" (mặt/đồ vật bị nhận nhầm) và
 * quyết định xem có đúng là NGƯỜI CHƠI ĐANG GIƠ CẢ HAI TAY hay không.
 *
 * Vì sao cần: mô hình đôi khi trả về 2 "bàn tay" trong khi thực tế chỉ có 1 tay
 * (bản trùng bị lỗi hình học: các gốc ngón dồn vào nhau nên khoảng cách
 * ngón trỏ–ngón út gần bằng 0). Nếu không lọc, giơ 1 tay cũng bị hiểu là
 * "giơ cả 2 tay" → tự chuyển trang.
 *
 * Số liệu thực đo trên mô hình trong repo:
 *   - tay thật:   spreadRatio ≈ 1,27 · reachRatio ≈ 2,2
 *   - bản trùng:  spreadRatio ≈ 0,10–0,25  (gốc ngón dồn lại) → loại
 */

/** Các số đo hình học cơ bản của một "bàn tay" 21 điểm. */
export function handMetrics(lm) {
  if (!lm || lm.length < 21) return null;
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));

  // Kích thước lòng bàn tay: cổ tay → gốc ngón giữa
  const palm = d(lm[0], lm[9]);
  if (!Number.isFinite(palm) || palm < 1e-4) return null;

  // Bề ngang khớp bàn tay: gốc ngón trỏ → gốc ngón út
  const spread = d(lm[5], lm[17]);
  // Tầm với của ngón giữa: cổ tay → đầu ngón giữa
  const reach = d(lm[0], lm[12]);

  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  lm.forEach((p) => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });

  return {
    palm,
    spreadRatio: spread / palm,
    reachRatio: reach / palm,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    wristY: lm[0].y,
    bbox: { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY },
  };
}

/** Bàn tay này có hình dạng hợp lý không (loại bản trùng / mặt bị nhận nhầm). */
export function isPlausibleHand(lm, score, cfg = {}) {
  const m = handMetrics(lm);
  if (!m) return false;

  const minScore = cfg.minScore ?? 0.5;
  if (score != null && score < minScore) return false;

  const [sMin, sMax] = cfg.spread ?? [0.35, 2.0];
  if (m.spreadRatio < sMin || m.spreadRatio > sMax) return false;

  const [rMin, rMax] = cfg.reach ?? [0.9, 2.8];
  if (m.reachRatio < rMin || m.reachRatio > rMax) return false;

  // Khung hình quá nhỏ (vài pixel) → không đáng tin
  const minArea = cfg.minArea ?? 0.0015;
  if (m.bbox.w * m.bbox.h < minArea) return false;

  return true;
}

/** Tay có "giơ lên" không: cổ tay và gốc ngón giữa ở nửa trên khung hình. */
export function isRaised(lm, maxY = 0.72) {
  const m = handMetrics(lm);
  if (!m) return false;
  const topY = Math.min(lm[9]?.y ?? 1, lm[0]?.y ?? 1);
  return topY < maxY;
}

/**
 * Danh sách tay coi là hợp lệ (đã lọc).
 * @param {Array} list  multiHandLandmarks
 * @param {Array} handedness multiHandedness
 */
export function pickValidHands(list = [], handedness = [], cfg = {}) {
  const out = [];
  list.forEach((lm, i) => {
    const h = handedness[i] || {};
    const ok = cfg.enabled === false || isPlausibleHand(lm, h.score, cfg);
    if (!ok) return;
    const m = handMetrics(lm);
    out.push({ index: i, lm, label: h.label || null, score: h.score ?? null, metrics: m });
  });
  return out;
}

/**
 * Người chơi có đang giơ CẢ HAI tay không?
 * Điều kiện: đúng 2 tay hợp lệ trở lên, khác tay (Left + Right), cùng giơ lên,
 * và cách xa nhau theo phương ngang (một tay trái một tay phải thật sự).
 */
export function twoHandsRaised(hands = [], cfg = {}) {
  if (hands.length < 2) return false;
  const maxY = cfg.maxY ?? 0.72;
  const minGap = cfg.minGap ?? 0.1;
  const pair = hands.slice(0, 2);

  if (!pair.every((h) => isRaised(h.lm, maxY))) return false;

  // Phải là hai bàn tay khác nhau; nếu mô hình trả 2 tay cùng nhãn thì bỏ qua
  const labels = pair.map((h) => h.label).filter(Boolean);
  const distinct = labels.length === 2 && labels[0] !== labels[1];
  const leftRight =
    distinct && labels.includes('Left') && labels.includes('Right');

  const gap = Math.abs(pair[0].metrics.centerX - pair[1].metrics.centerX);
  if (gap < minGap) return false;

  // Hai bàn tay thật ở cùng khoảng cách tới camera → kích thước lòng bàn tay tương đương.
  // Một "bàn tay" to gấp nhiều lần thường là mặt/khuôn hình bị nhận nhầm.
  const p0 = pair[0].metrics.palm;
  const p1 = pair[1].metrics.palm;
  const ratio = Math.max(p0, p1) / Math.max(1e-4, Math.min(p0, p1));
  const [sizeMin, sizeMax] = cfg.sizeRatio ?? [0.4, 2.5];
  if (ratio < sizeMin || ratio > sizeMax) return false;

  // Nhãn có thể bị đảo (gương) → chỉ cần 2 nhãn khác nhau là đủ
  return distinct || leftRight;
}
