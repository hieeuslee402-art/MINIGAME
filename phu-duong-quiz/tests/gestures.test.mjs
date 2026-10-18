/**
 * tests/gestures.test.mjs
 * Kiểm tra thuật toán cử chỉ (không còn gạt/vuốt tay):
 *   cái+trỏ = A · cái+giữa = B · cái+áp út = C · cái+út = D · trỏ+giữa = chuyển câu
 * Chạy: npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GestureEngine } from '../js/core/gestures.js';
import { CONFIG } from '../js/config.js';
import { SENSITIVITY_PRESETS, applySensitivity } from '../js/core/sensitivity.js';

/* --------------------------------------------------------------- tiện ích */

const TIP = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };

/**
 * Bàn tay mở: các đầu ngón cách xa nhau.
 * palmX = 0.5 → toạ độ chuẩn; các ngón xếp từ trái sang phải (ảnh camera chưa lật).
 */
function openHand(palmX = 0.5) {
  const lm = Array.from({ length: 21 }, () => ({ x: palmX, y: 0.5, z: 0 }));
  lm[0] = { x: palmX, y: 0.82, z: 0 }; // cổ tay
  lm[5] = { x: palmX - 0.06, y: 0.5, z: 0 }; // gốc ngón trỏ
  lm[9] = { x: palmX + 0.01, y: 0.49, z: 0 }; // gốc ngón giữa
  lm[13] = { x: palmX + 0.08, y: 0.5, z: 0 };
  lm[17] = { x: palmX + 0.14, y: 0.52, z: 0 };
  lm[4] = { x: palmX - 0.3, y: 0.6, z: 0 }; // ngón cái buông xa
  lm[8] = { x: palmX - 0.055, y: 0.24, z: 0 };
  lm[12] = { x: palmX + 0.015, y: 0.23, z: 0 };
  lm[16] = { x: palmX + 0.085, y: 0.25, z: 0 };
  lm[20] = { x: palmX + 0.15, y: 0.29, z: 0 };
  return lm;
}

/** Ngón cái chạm một ngón: 'index' | 'middle' | 'ring' | 'pinky' */
function thumbTouch(palmX = 0.5, finger = 'index') {
  const lm = openHand(palmX);
  const target = { x: lm[TIP[finger]].x, y: lm[TIP[finger]].y + 0.06, z: 0 };
  lm[TIP.thumb] = { ...target };
  lm[TIP[finger]] = { ...target };
  return lm;
}

/** Giơ tay như ảnh: ngón trỏ + ngón giữa duỗi và bắt chéo, áp út + út gập lại. */
function crossedHand(palmX = 0.5) {
  const lm = openHand(palmX);
  lm[6] = { x: palmX - 0.06, y: 0.4, z: 0 };
  lm[8] = { x: palmX + 0.02, y: 0.22, z: 0 };
  lm[10] = { x: palmX + 0.01, y: 0.39, z: 0 };
  lm[12] = { x: palmX - 0.02, y: 0.21, z: 0 };
  lm[14] = { x: palmX + 0.08, y: 0.55, z: 0 };
  lm[16] = { x: palmX + 0.075, y: 0.6, z: 0 };
  lm[18] = { x: palmX + 0.14, y: 0.56, z: 0 };
  lm[20] = { x: palmX + 0.135, y: 0.61, z: 0 };
  lm[4] = { x: palmX - 0.28, y: 0.62, z: 0 }; // ngón cái để xa
  return lm;
}

function makeEngine() {
  const log = [];
  const engine = new GestureEngine({
    onOption: (key, meta) => log.push({ key, type: meta.type, chord: meta.chord }),
    onNext: (meta) => log.push({ key: 'next', source: meta?.source || 'fingers' }),
  });
  return { engine, log };
}

/** Đưa cử chỉ vào engine: giữ `holdMs` rồi nhả, sau khi tay đã ở trong khung. */
function runGesture(makeHand, { holdMs = 160, fps = 30, releaseMs = 120 } = {}) {
  const { engine, log } = makeEngine();
  const frame = 1000 / fps;
  let t = 3000;

  for (let i = 0; i < 10; i += 1) {
    t += frame;
    engine.update(openHand(), t);
  }

  const start = t;
  t += frame;
  engine.update(makeHand(), t);
  while (t - start < holdMs) {
    t += frame;
    engine.update(makeHand(), t);
  }

  // nhả tay
  const releaseStart = t;
  while (t - releaseStart < releaseMs) {
    t += frame;
    engine.update(openHand(), t);
  }

  return { log, engine };
}

/* ------------------------------------------------------------------ tests */

test('ngón cái chạm ngón trỏ → A', () => {
  const { log } = runGesture(() => thumbTouch(0.5, 'index'));
  assert.deepEqual(log.map((x) => x.key), ['A']);
  assert.equal(log[0].type, 'touch');
});

test('ngón cái chạm ngón giữa → B', () => {
  const { log } = runGesture(() => thumbTouch(0.5, 'middle'));
  assert.deepEqual(log.map((x) => x.key), ['B']);
});

test('ngón cái chạm ngón áp út → C', () => {
  const { log } = runGesture(() => thumbTouch(0.5, 'ring'));
  assert.deepEqual(log.map((x) => x.key), ['C']);
});

test('ngón cái chạm ngón út → D', () => {
  const { log } = runGesture(() => thumbTouch(0.5, 'pinky'));
  assert.deepEqual(log.map((x) => x.key), ['D']);
});

/** Tạm bật cử chỉ chuyển trang bằng 1 tay (mặc định đã tắt) để kiểm tra riêng nó. */
function withOneHandPose(fn) {
  const prev = CONFIG.gestures.allowOneHandNext;
  CONFIG.gestures.allowOneHandNext = true;
  try {
    return fn();
  } finally {
    CONFIG.gestures.allowOneHandNext = prev;
  }
}

test('mặc định: giơ 1 tay chéo ngón KHÔNG chuyển trang', () => {
  const { log } = runGesture(() => crossedHand());
  assert.deepEqual(log, []);
});

test('khi bật allowOneHandNext: giơ tay, trỏ + giữa bắt chéo → chuyển câu', () => {
  const { log } = withOneHandPose(() => runGesture(() => crossedHand()));
  assert.deepEqual(log.map((x) => x.key), ['next']);
  assert.equal(log[0].source, 'hand');
});

test('giơ tay chéo ngón nhưng ngón cái đang chạm trỏ → không chuyển câu', () => {
  const hand = () => {
    const lm = crossedHand();
    lm[TIP.thumb] = { ...lm[TIP.index] }; // ngón cái chạm luôn ngón trỏ
    return lm;
  };
  const { log } = withOneHandPose(() => runGesture(hand));
  assert.ok(!log.some((x) => x.key === 'next'), 'không được chuyển câu');
});

test('xòe cả bàn tay (5 ngón) không chuyển câu', () => {
  const { log } = runGesture(() => openHand());
  assert.deepEqual(log, []);
});

test('giơ 2 ngón hình chữ V (không bắt chéo) không chuyển câu', () => {
  const hand = () => {
    const lm = crossedHand();
    lm[TIP.index] = { x: 0.42, y: 0.22, z: 0 }; // tách 2 đầu ngón ra xa
    lm[TIP.middle] = { x: 0.6, y: 0.22, z: 0 };
    return lm;
  };
  const { log } = withOneHandPose(() => runGesture(hand));
  assert.deepEqual(log, []);
});

test('giơ tay chéo ngón, hạ tay rồi giơ lại → chuyển câu lần 2', () => {
  CONFIG.gestures.allowOneHandNext = true;
  const { engine, log } = makeEngine();
  const frame = 33;
  let t = 3000;
  for (let i = 0; i < 10; i += 1) {
    t += frame;
    engine.update(openHand(), t);
  }
  for (let round = 0; round < 2; round += 1) {
    for (let i = 0; i < 4; i += 1) {
      t += frame;
      engine.update(crossedHand(), t);
    }
    for (let i = 0; i < 6; i += 1) {
      t += frame;
      engine.update(openHand(), t);
    }
    // chờ hết cooldown
    const wait = CONFIG.gestures.chord.cooldownMs + 100;
    const start = t;
    while (t - start < wait) {
      t += frame;
      engine.update(openHand(), t);
    }
  }
  assert.deepEqual(log.map((x) => x.key), ['next', 'next']);
});

test('chỉ bắn một lần dù giữ chạm lâu (khoá chống lặp)', () => {
  const { log } = runGesture(() => thumbTouch(0.5, 'index'), { holdMs: 1500 });
  assert.deepEqual(log.map((x) => x.key), ['A']);
});

test('chạm rồi nhả rồi chạm lại sau thời gian chờ → nhận lần 2', () => {
  const { engine, log } = makeEngine();
  const frame = 33;
  let t = 3000;
  for (let i = 0; i < 10; i += 1) {
    t += frame;
    engine.update(openHand(), t);
  }

  // lần 1
  t += frame;
  engine.update(thumbTouch(0.5, 'ring'), t);
  t += frame;
  engine.update(openHand(), t);

  // chờ hơn cooldown
  const wait = CONFIG.gestures.chord.cooldownMs + 120;
  const waitStart = t;
  while (t - waitStart < wait) {
    t += frame;
    engine.update(openHand(), t);
  }

  // lần 2
  t += frame;
  engine.update(thumbTouch(0.5, 'pinky'), t);

  assert.deepEqual(log.map((x) => x.key), ['C', 'D']);
});

test('vẫn đúng khi camera chậm 8 khung/giây', () => {
  const { log } = runGesture(() => thumbTouch(0.5, 'ring'), { fps: 8, holdMs: 300 });
  assert.deepEqual(log.map((x) => x.key), ['C']);
});

test('vẫn đúng khi camera rất nhanh 60 khung/giây', () => {
  const { log } = runGesture(() => thumbTouch(0.5, 'pinky'), { fps: 60, holdMs: 100 });
  assert.deepEqual(log.map((x) => x.key), ['D']);
});

test('mất tay rồi xuất hiện lại: không bắn thêm khi chưa nhả', () => {
  const { engine, log } = makeEngine();
  const frame = 33;
  let t = 3000;
  for (let i = 0; i < 10; i += 1) {
    t += frame;
    engine.update(openHand(), t);
  }

  // chạm C → bắn đúng 1 lần
  t += frame;
  engine.update(thumbTouch(0.5, 'ring'), t);
  t += frame;
  engine.update(thumbTouch(0.5, 'ring'), t);

  // mất tay
  t += frame;
  engine.update(null, t);
  t += frame;
  engine.update(null, t);

  // hiện lại vẫn đang chạm → không được bắn lần nữa
  for (let i = 0; i < 12; i += 1) {
    t += frame;
    engine.update(thumbTouch(0.5, 'ring'), t);
  }

  // nhả rồi chạm lại → được tính
  for (let i = 0; i < 6; i += 1) {
    t += frame;
    engine.update(openHand(), t);
  }
  t += frame;
  engine.update(thumbTouch(0.5, 'pinky'), t);

  assert.deepEqual(log.map((x) => x.key), ['C', 'D']);
});

test('tay đứng yên không kích hoạt gì', () => {
  const { engine, log } = makeEngine();
  let t = 3000;
  for (let i = 0; i < 120; i += 1) {
    t += 16;
    engine.update(openHand(0.5), t);
  }
  assert.deepEqual(log, []);
});

test('cấu hình: đủ 4 cặp ngón cho A–D và quét ≥ 30 khung/giây', () => {
  const c = CONFIG.gestures.chord;
  assert.ok(c.touchOn < c.touchOff, 'ngưỡng vào phải nhỏ hơn ngưỡng ra');
  assert.ok(c.margin > 0 && c.margin < 1, 'cần biên an toàn giữa 2 cặp ngón');
  assert.ok(CONFIG.camera.fps >= 30, 'tốc độ quét tối thiểu 30 khung/giây');
  assert.ok(CONFIG.camera.maxFps >= 30);
});

test('ba mức độ nhạy: Mạnh dễ nhận hơn Nhẹ, áp dụng đúng vào config', () => {
  const { soft, normal, strong } = SENSITIVITY_PRESETS;
  assert.ok(soft.chord.touchOn < normal.chord.touchOn);
  assert.ok(normal.chord.touchOn < strong.chord.touchOn);
  assert.ok(soft.chord.margin > strong.chord.margin, 'mức Nhẹ phải khắt khe hơn khi 2 cặp cùng chạm');

  applySensitivity('strong');
  assert.equal(CONFIG.gestures.chord.touchOn, strong.chord.touchOn);


  applySensitivity('normal');
  assert.equal(CONFIG.gestures.chord.touchOn, 0.36);

});

/* ---------------------------------------------- cử chỉ giơ cả hai tay */

function feedTwoHands(frames = 4, fps = 30) {
  const { engine, log } = makeEngine();
  const frame = 1000 / fps;
  let t = 3000;
  for (let i = 0; i < 12; i += 1) {
    t += frame;
    engine.update(openHand(), t, { handsCount: 1, twoHandsUp: false });
  }
  for (let i = 0; i < frames; i += 1) {
    t += frame;
    engine.update(openHand(), t, { handsCount: 2, twoHandsUp: true });
  }
  return { engine, log, t, frame };
}

test('giơ cả 2 tay → chuyển câu', () => {
  const { log } = feedTwoHands();
  assert.deepEqual(log.map((x) => x.key), ['next']);
  assert.equal(log[0].source, 'hand');
});

test('giữ 2 tay lâu chỉ chuyển một lần (phải hạ tay rồi giơ lại)', () => {
  const { log } = feedTwoHands(40);
  assert.deepEqual(log.map((x) => x.key), ['next']);
});

test('2 tay giơ lên thì không đoán đáp án dù ngón cái đang chạm trỏ', () => {
  const { engine, log } = makeEngine();
  const frame = 33;
  let t = 3000;
  for (let i = 0; i < 12; i += 1) {
    t += frame;
    engine.update(openHand(), t, { handsCount: 1, twoHandsUp: false });
  }
  for (let i = 0; i < 5; i += 1) {
    t += frame;
    engine.update(thumbTouch(0.5, 'index'), t, { handsCount: 2, twoHandsUp: true });
  }
  assert.deepEqual(log.map((x) => x.key), ['next'], 'chỉ được chuyển câu');
});

test('hạ xuống còn 1 tay rồi giơ lại 2 tay → chuyển câu lần nữa', () => {
  const { engine, log } = makeEngine();
  const frame = 33;
  let t = 3000;
  const step = (hands) => {
    t += frame;
    engine.update(openHand(), t, hands);
  };
  for (let i = 0; i < 12; i += 1) step({ handsCount: 1, twoHandsUp: false });
  for (let i = 0; i < 4; i += 1) step({ handsCount: 2, twoHandsUp: true });
  for (let i = 0; i < 30; i += 1) step({ handsCount: 1, twoHandsUp: false }); // hạ tay + hết cooldown
  for (let i = 0; i < 4; i += 1) step({ handsCount: 2, twoHandsUp: true });

  assert.deepEqual(log.map((x) => x.key), ['next', 'next']);
});

test('thấy 2 tay nhưng không giơ lên (ngoài nửa trên khung) thì không chuyển câu', () => {
  const { engine, log } = makeEngine();
  const frame = 33;
  let t = 3000;
  for (let i = 0; i < 12; i += 1) {
    t += frame;
    engine.update(openHand(), t, { handsCount: 2, twoHandsUp: false });
  }
  for (let i = 0; i < 10; i += 1) {
    t += frame;
    engine.update(openHand(), t, { handsCount: 2, twoHandsUp: false });
  }
  assert.deepEqual(log, []);
});

/* ------------------------------------------- hai tay: mỗi tay tự nhận A–D */

/** Đưa một danh sách tay vào engine (mỗi phần tử {label, landmarks}). */
function runHandsGesture(handsAt, { frames = 14, fps = 30 } = {}) {
  const { engine, log } = makeEngine();
  const frame = 1000 / fps;
  let t = 3000;

  const step = (hands) => {
    t += frame;
    const list = (hands || []).map((h) => ({ label: h.label, landmarks: h.landmarks }));
    engine.update(list[0]?.landmarks || null, t, {
      hands: list,
      handsCount: list.length,
      twoHandsUp: false,
    });
  };

  for (let i = 0; i < 10; i += 1) step([{ label: 'Left', landmarks: openHand(0.45) }]);
  for (let i = 0; i < frames; i += 1) step(typeof handsAt === 'function' ? handsAt(i) : handsAt);

  return { engine, log };
}

test('tay PHẢI: cái + trỏ → A', () => {
  const { log } = runHandsGesture([{ label: 'Right', landmarks: thumbTouch(0.66, 'index') }]);
  assert.deepEqual(log.map((x) => x.key), ['A']);
});

test('tay PHẢI: cái + út → D', () => {
  const { log } = runHandsGesture([{ label: 'Right', landmarks: thumbTouch(0.66, 'pinky') }]);
  assert.deepEqual(log.map((x) => x.key), ['D']);
});

test('tay TRÁI: cái + áp út → C', () => {
  const { log } = runHandsGesture([{ label: 'Left', landmarks: thumbTouch(0.4, 'ring') }]);
  assert.deepEqual(log.map((x) => x.key), ['C']);
});

test('2 tay cùng chạm ngón → chỉ chọn MỘT đáp án (không bắn 2 lần)', () => {
  const { log } = runHandsGesture([
    { label: 'Left', landmarks: thumbTouch(0.38, 'ring') },
    { label: 'Right', landmarks: thumbTouch(0.68, 'index') },
  ]);
  assert.equal(log.length, 1);
  assert.ok(['A', 'C'].includes(log[0].key));
});

test('2 tay: tay trái để mở, tay phải chạm → vẫn nhận đáp án của tay phải', () => {
  const { log } = runHandsGesture([
    { label: 'Left', landmarks: openHand(0.34) },
    { label: 'Right', landmarks: thumbTouch(0.7, 'ring') },
  ]);
  assert.deepEqual(log.map((x) => x.key), ['C']);
});

test('đổi tay giữa chừng: tay trái chạm B rồi tay phải chạm B vẫn nhận đúng', () => {
  const { engine, log } = makeEngine();
  const frame = 1000 / 30;
  let t = 3000;
  const step = (hands) => {
    t += frame;
    const list = hands.map((h) => ({ label: h.label, landmarks: h.landmarks }));
    engine.update(list[0]?.landmarks || null, t, {
      hands: list,
      handsCount: list.length,
      twoHandsUp: false,
    });
  };

  for (let i = 0; i < 10; i += 1) step([{ label: 'Left', landmarks: openHand(0.45) }]);
  for (let i = 0; i < 8; i += 1) step([{ label: 'Left', landmarks: thumbTouch(0.45, 'middle') }]);
  // nhả, rồi chạm tiếp bằng tay phải sau cooldown
  for (let i = 0; i < 6; i += 1) step([{ label: 'Left', landmarks: openHand(0.45) }]);
  for (let i = 0; i < 6; i += 1) step([]);
  for (let i = 0; i < 6; i += 1) step([{ label: 'Right', landmarks: openHand(0.66) }]);
  for (let i = 0; i < 8; i += 1) step([{ label: 'Right', landmarks: thumbTouch(0.66, 'middle') }]);

  assert.deepEqual(log.map((x) => x.key), ['B', 'B']);
});

test('2 tay giơ lên (twoHandsUp) → không đoán đáp án dù có chạm ngón', () => {
  const { engine, log } = makeEngine();
  const frame = 1000 / 30;
  let t = 3000;
  const hands = [
    { label: 'Left', landmarks: thumbTouch(0.38, 'index') },
    { label: 'Right', landmarks: thumbTouch(0.68, 'index') },
  ];
  for (let i = 0; i < 24; i += 1) {
    t += frame;
    engine.update(hands[0].landmarks, t, { hands, handsCount: 2, twoHandsUp: true });
  }
  assert.deepEqual(log.filter((x) => x.key !== 'next'), []);
});

test('không truyền hands (API cũ) vẫn nhận đúng', () => {
  const { engine, log } = makeEngine();
  let t = 3000;
  for (let i = 0; i < 10; i += 1) {
    t += 33;
    engine.update(openHand(), t);
  }
  for (let i = 0; i < 10; i += 1) {
    t += 33;
    engine.update(thumbTouch(0.5, 'index'), t, { handsCount: 1, twoHandsUp: false });
  }
  assert.deepEqual(log.map((x) => x.key), ['A']);
});
