/**
 * tests/handFilter.test.mjs
 * Lọc "bàn tay ảo" (mặt/đồ vật bị nhận nhầm, bản trùng của cùng một tay)
 * và điều kiện "giơ cả 2 tay".
 *
 * Số liệu dùng ở đây lấy từ lần đo thật với mô hình trong repo:
 *   tay thật  → spreadRatio 1,27 · reachRatio 2,22 · score 0,937
 *   bản trùng → spreadRatio 0,10–0,25 (gốc ngón dồn lại) · score 0,775–0,888
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handMetrics,
  isPlausibleHand,
  isRaised,
  pickValidHands,
  twoHandsRaised,
} from '../js/core/handFilter.js';
import { CONFIG } from '../js/config.js';

/** Bàn tay thật, dựng theo tỉ lệ đo được (spreadRatio ≈ 1,2 · reachRatio ≈ 2,2). */
function realHand(cx = 0.35, topY = 0.24) {
  const lm = Array.from({ length: 21 }, () => ({ x: cx, y: 0.5, z: 0 }));
  const palm = 0.3; // cổ tay → gốc ngón giữa
  lm[0] = { x: cx, y: topY + 0.5, z: 0 };
  lm[9] = { x: cx, y: topY + 0.2, z: 0 };
  lm[5] = { x: cx - palm * 0.6, y: topY + 0.21, z: 0 };
  lm[17] = { x: cx + palm * 0.6, y: topY + 0.22, z: 0 };
  lm[4] = { x: cx - 0.3, y: topY + 0.3, z: 0 };
  lm[8] = { x: cx - 0.07, y: topY, z: 0 };
  lm[12] = { x: cx + 0.01, y: topY - 0.01, z: 0 };
  lm[16] = { x: cx + 0.09, y: topY + 0.01, z: 0 };
  lm[20] = { x: cx + 0.16, y: topY + 0.05, z: 0 };
  return lm;
}

/** Bản nhận nhầm: các gốc ngón dồn vào nhau (spreadRatio ≈ 0,1–0,25). */
function bogusHand(cx = 0.5, topY = 0.3) {
  const lm = realHand(cx, topY);
  lm[5] = { x: cx - 0.02, y: topY + 0.2, z: 0 };
  lm[17] = { x: cx + 0.03, y: topY + 0.21, z: 0 };
  return lm;
}

test('tay thật: hình dạng hợp lý', () => {
  const lm = realHand();
  const m = handMetrics(lm);
  assert.ok(m.spreadRatio > 0.8 && m.spreadRatio < 1.6, `spreadRatio=${m.spreadRatio}`);
  assert.ok(m.reachRatio > 1.2 && m.reachRatio < 2.6, `reachRatio=${m.reachRatio}`);
  assert.equal(isPlausibleHand(lm, 0.937, CONFIG.hand.plausibility), true);
});

test('bản trùng / mặt bị nhận nhầm: bị loại', () => {
  assert.equal(isPlausibleHand(bogusHand(), 0.88, CONFIG.hand.plausibility), false);
  assert.equal(pickValidHands([realHand(), bogusHand()], [{ score: 0.9 }, { score: 0.88 }], CONFIG.hand.plausibility).length, 1);
});

test('độ tin cậy quá thấp: bị loại', () => {
  assert.equal(isPlausibleHand(realHand(), 0.31, CONFIG.hand.plausibility), false);
});

test('khung hình quá nhỏ (vài pixel): bị loại', () => {
  const tiny = realHand().map((p) => ({ x: p.x * 0.02 + 0.5, y: p.y * 0.02 + 0.5, z: 0 }));
  assert.equal(isPlausibleHand(tiny, 0.9, CONFIG.hand.plausibility), false);
});

test('isRaised: tay trên nửa khung = giơ lên, tay thấp = không', () => {
  assert.equal(isRaised(realHand(0.35, 0.24), 0.72), true);
  assert.equal(isRaised(realHand(0.35, 0.6), 0.72), false);
});

test('2 tay thật, khác nhãn, cách xa, cùng giơ → giơ cả 2 tay', () => {
  const hands = pickValidHands(
    [realHand(0.3), realHand(0.7)],
    [{ label: 'Left', score: 0.95 }, { label: 'Right', score: 0.94 }],
    CONFIG.hand.plausibility
  );
  assert.equal(hands.length, 2);
  assert.equal(
    twoHandsRaised(hands, { maxY: 0.72, minGap: 0.1 }),
    true
  );
});

test('1 tay thật + 1 bản trùng → KHÔNG phải giơ 2 tay', () => {
  const hands = pickValidHands(
    [realHand(0.35), bogusHand(0.65)],
    [{ label: 'Left', score: 0.95 }, { label: 'Right', score: 0.88 }],
    CONFIG.hand.plausibility
  );
  assert.equal(hands.length, 1);
  assert.equal(twoHandsRaised(hands, { maxY: 0.72, minGap: 0.1 }), false);
});

test('2 tay cùng nhãn (mô hình trả trùng) → không tính là 2 tay', () => {
  const hands = pickValidHands(
    [realHand(0.3), realHand(0.7)],
    [{ label: 'Left', score: 0.95 }, { label: 'Left', score: 0.9 }],
    CONFIG.hand.plausibility
  );
  assert.equal(twoHandsRaised(hands, { maxY: 0.72, minGap: 0.1 }), false);
});

test('2 tay sát nhau (cùng một tay bị tách đôi) → không tính', () => {
  const hands = pickValidHands(
    [realHand(0.48), realHand(0.5)],
    [{ label: 'Left', score: 0.95 }, { label: 'Right', score: 0.9 }],
    CONFIG.hand.plausibility
  );
  assert.equal(twoHandsRaised(hands, { maxY: 0.72, minGap: 0.1 }), false);
});

test('2 tay để thấp → không tính là giơ tay', () => {
  const hands = pickValidHands(
    [realHand(0.3, 0.62), realHand(0.7, 0.62)],
    [{ label: 'Left', score: 0.95 }, { label: 'Right', score: 0.92 }],
    CONFIG.hand.plausibility
  );
  assert.equal(twoHandsRaised(hands, { maxY: 0.72, minGap: 0.1 }), false);
});

test('config: đã bật lọc tay ảo và TẮT chuyển trang bằng 1 tay', () => {
  assert.equal(CONFIG.hand.plausibility.enabled, true);
  assert.equal(CONFIG.gestures.allowOneHandNext, false);
  assert.ok(CONFIG.hand.twoHandsMinGap > 0);
});

test('một "tay" to gấp nhiều lần (mặt bị nhận nhầm) → không tính là giơ 2 tay', () => {
  const big = realHand(0.7).map((p) => ({ x: (p.x - 0.7) * 3 + 0.7, y: (p.y - 0.4) * 3 + 0.4, z: 0 }));
  const hands = pickValidHands(
    [realHand(0.25), big],
    [{ label: 'Left', score: 0.95 }, { label: 'Right', score: 0.9 }],
    CONFIG.hand.plausibility
  );
  assert.equal(hands.length, 2, 'cả hai vẫn hợp lệ về hình dạng');
  assert.equal(twoHandsRaised(hands, { maxY: 0.9, minGap: 0.1 }), false);
});
