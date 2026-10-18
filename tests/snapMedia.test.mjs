/**
 * tests/snapMedia.test.mjs
 * Kiểm tra: bộ nhận búng tay (tín hiệu âm thanh) và bộ tìm file media
 * (dung/dung.mp3, sai/sai.mp3, end/outro.mp4).
 * Chạy: npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SNAP_DEFAULTS,
  detectSnap,
  updateFloor,
  WORKLET_CODE,
  SnapDetector,
} from '../js/core/snapDetector.js';
import { SOURCES, urlExists, MediaAssets } from '../js/core/mediaAssets.js';
import { CONFIG } from '../js/config.js';

/** Nền yên tĩnh: hf/rms rất nhỏ. */
const QUIET = { hf: 0.0008, rms: 0.003, hfFloor: 0.001, rmsFloor: 0.004, sinceLast: 5000 };

test('im lặng → không nhận là búng tay', () => {
  assert.equal(detectSnap(QUIET), false);
});

test('một xung sắc, to hơn nền nhiều lần → đúng là búng tay', () => {
  const hit = { hf: 0.09, rms: 0.06, hfFloor: 0.001, rmsFloor: 0.004, sinceLast: 5000 };
  assert.equal(detectSnap(hit), true);
});

test('tiếng ồn đều (không sắc) → không nhận', () => {
  const noise = { hf: 0.012, rms: 0.09, hfFloor: 0.001, rmsFloor: 0.004, sinceLast: 5000 };
  assert.equal(detectSnap(noise), false);
});

test('giọng nói to, ít âm cao → không nhận', () => {
  const voice = { hf: 0.02, rms: 0.12, hfFloor: 0.001, rmsFloor: 0.004, sinceLast: 5000 };
  assert.equal(detectSnap(voice), false);
});

test('hai tiếng búng quá gần nhau → bỏ tiếng thứ hai', () => {
  const hit = { hf: 0.09, rms: 0.06, hfFloor: 0.001, rmsFloor: 0.004, sinceLast: 100 };
  assert.equal(detectSnap(hit), false);
});

test('phòng ồn nền lớn: xung phải vượt nền theo tỉ lệ', () => {
  const floor = { hfFloor: 0.02, rmsFloor: 0.03 };
  const weak = { hf: 0.07, rms: 0.08, ...floor, sinceLast: 5000 };
  const strong = { hf: 0.25, rms: 0.2, ...floor, sinceLast: 5000 };
  assert.equal(detectSnap(weak), false);
  assert.equal(detectSnap(strong), true);
});

test('thiếu số liệu / NaN → false (không bao giờ ném lỗi)', () => {
  assert.equal(detectSnap(null), false);
  assert.equal(detectSnap({}), false);
  assert.equal(detectSnap({ hf: NaN, rms: 0.1 }), false);
});

test('updateFloor: nền tăng nhanh, giảm chậm', () => {
  const up = updateFloor(0.01, 0.5);
  const down = updateFloor(0.5, 0.01);
  assert.ok(up > 0.01 && up < 0.5);
  assert.ok(down < 0.5 && down > 0.01);
  assert.ok(0.5 - down < down - 0.01 + 1e-9); // giảm chậm hơn
});

test('AudioWorklet đếm mẫu, gửi mỗi ~512 mẫu', () => {
  assert.match(WORKLET_CODE, /registerProcessor\('snap-meter'/);
  assert.match(WORKLET_CODE, /512/);
});

test('SnapDetector chịu được môi trường không có micro', async () => {
  const det = new SnapDetector({});
  det.supported = false;
  const ok = await det.start();
  assert.equal(ok, false);
  assert.equal(det.active, false);
  det.stop();
});

test('SnapDetector: onSnap được gọi khi có xung súng, tôn trọng khoảng cách', () => {
  const hits = [];
  const det = new SnapDetector({ onSnap: (info) => hits.push(info) });
  det._lastSnapAt = performance.now() - 5000; // giả lập: lần búng trước đã lâu
  // mồi nền
  for (let i = 0; i < 40; i += 1) det._onMeter({ hf: 0.0008, rms: 0.002 });
  for (let i = 0; i < 6; i += 1) det._onMeter({ hf: 0.12, rms: 0.08 });
  assert.equal(hits.length, 1);
});

test('đường dẫn file đúng tên người dùng yêu cầu', () => {
  assert.equal(SOURCES.dung[0], 'dung/dung.mp3');
  assert.equal(SOURCES.sai[0], 'sai/sai.mp3');
  assert.equal(SOURCES.video[0], 'end/outro.mp4');
  assert.equal(CONFIG.media.correct[0], 'dung/dung.mp3');
  assert.equal(CONFIG.media.wrong[0], 'sai/sai.mp3');
  assert.equal(CONFIG.media.video[0], 'end/outro.mp4');
});

test('urlExists: 200 → true, 404 → false', async () => {
  const ok = await urlExists('a.mp3', async () => ({ ok: true, status: 200 }));
  const no = await urlExists('b.mp3', async () => ({ ok: false, status: 404 }));
  assert.equal(ok, true);
  assert.equal(no, false);
});

test('urlExists: HEAD bị chặn (405) → thử GET Range', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push(opts.method);
    if (opts.method === 'HEAD') return { ok: false, status: 405 };
    return { ok: true, status: 206 };
  };
  assert.equal(await urlExists('x.mp3', fetchImpl), true);
  assert.deepEqual(calls, ['HEAD', 'GET']);
});

test('urlExists: lỗi mạng → false', async () => {
  assert.equal(await urlExists('x.mp3', async () => Promise.reject(new Error('offline'))), false);
});

test('MediaAssets chọn file đầu tiên tồn tại theo đúng thứ tự', async () => {
  const audio = [];
  class FakeAudio {
    constructor(url) {
      this.url = url;
      this.volume = 1;
      this.played = 0;
      audio.push(this);
    }
    play() {
      this.played += 1;
      return Promise.resolve();
    }
  }
  const fetchImpl = async (url) => ({ ok: url.includes('dung.mp3') || url.includes('outro.mp4'), status: 200 });
  const media = new MediaAssets({ fetchImpl, AudioCtor: FakeAudio });
  const urls = await media.resolve();
  assert.equal(urls.dung, 'dung/dung.mp3');
  assert.equal(urls.sai, null);
  assert.equal(urls.video, 'end/outro.mp4');
  assert.equal(media.play('dung'), true);
  assert.equal(media.play('sai'), false); // thiếu file → nơi gọi dùng âm tổng hợp
  assert.equal(audio.length, 1);
  assert.equal(audio[0].played, 1);
});

test('MediaAssets: không có file nào → play() luôn false (không ném lỗi)', async () => {
  const media = new MediaAssets({
    fetchImpl: async () => ({ ok: false, status: 404 }),
    AudioCtor: class {},
  });
  await media.resolve();
  assert.equal(media.play('dung'), false);
  assert.equal(media.play('sai'), false);
  assert.equal(media.videoUrl, null);
  assert.equal(media.status.checked, true);
});

test('MediaAssets: chỉ kiểm tra file một lần', async () => {
  let calls = 0;
  const media = new MediaAssets({
    fetchImpl: async () => {
      calls += 1;
      return { ok: false, status: 404 };
    },
    AudioCtor: null,
  });
  await media.resolve();
  const first = calls;
  await media.resolve();
  assert.equal(calls, first);
});

test('ngưỡng snap nằm trong khoảng hợp lý', () => {
  assert.ok(SNAP_DEFAULTS.minIntervalMs >= 200 && SNAP_DEFAULTS.minIntervalMs <= 600);
  assert.ok(SNAP_DEFAULTS.hfRatio > 2.5);
  assert.ok(CONFIG.snap.minIntervalMs === SNAP_DEFAULTS.minIntervalMs);
});
