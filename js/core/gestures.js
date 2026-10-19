/**
 * core/gestures.js
 * Nhận diện cử chỉ bàn tay — dùng được với CẢ HAI TAY:
 *
 *   Ngón cái + ngón trỏ    → chọn A
 *   Ngón cái + ngón giữa   → chọn B
 *   Ngón cái + ngón áp út  → chọn C
 *   Ngón cái + ngón út     → chọn D
 *   Giơ CẢ HAI tay lên     → chuyển slide / câu tiếp
 *
 * Cách hoạt động:
 *   - Mỗi bàn tay được theo dõi riêng (trạng thái chạm, khoá chống lặp, cooldown).
 *   - Mỗi khung hình đo khoảng cách các cặp đầu ngón, chuẩn hoá theo kích thước bàn tay.
 *   - Cặp nào có tỉ lệ < touchOn thì coi là "đang chạm"; nhả ra khi > touchOff (chống rung).
 *   - Chỉ cặp rõ ràng nhất của mỗi tay mới được tính, và phải cách cặp thứ hai một khoảng an toàn
 *     → tránh trường hợp 2 ngón chạm ngón cái cùng lúc mà đoán bừa đáp án.
 *   - Kích hoạt ngay tại thời điểm bắt đầu chạm (không cần giữ, không cần nhả).
 *   - Chuyển trang: thấy 2 bàn tay hợp lệ cùng giơ lên (HandTracker tính) trong 3 khung liên tiếp.
 *   - Tuỳ chọn (mặc định TẮT): một tay trỏ + giữa bắt chéo cũng chuyển trang.
 */
import { CONFIG } from '../config.js';
import { dist } from '../utils/math.js';

const TIP = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
const PIP = { index: 6, middle: 10, ring: 14, pinky: 18 };
const MIDDLE_MCP = 9;

/** Danh sách cặp ngón → đáp án. */
const CHORDS = [
  { action: 'A', a: TIP.thumb, b: TIP.index, label: 'cái + trỏ' },
  { action: 'B', a: TIP.thumb, b: TIP.middle, label: 'cái + giữa' },
  { action: 'C', a: TIP.thumb, b: TIP.ring, label: 'cái + áp út' },
  { action: 'D', a: TIP.thumb, b: TIP.pinky, label: 'cái + út' },
];

/** Hành động chuyển trang. */
const NEXT = { action: 'NEXT', label: 'giơ cả 2 tay' };

/** Số khung hình liên tiếp phải giữ đúng tư thế trước khi nhận. */
const POSE_FRAMES = 2;
/** Cử chỉ "giơ cả 2 tay" cần nhiều khung hơn để chắc chắn (tránh nhận nhầm). */
const HANDS_FRAMES = 3;
/** Bàn tay biến mất quá lâu thì xoá trạng thái (không giữ khoá chống lặp). */
const HAND_TTL_MS = 800;

const EMPTY_CHORD_ACTIVE = () => ({ A: false, B: false, C: false, D: false });
const EMPTY_CHORD_LATCH = () => ({ A: false, B: false, C: false, D: false });

export class GestureEngine {
  constructor(handlers = {}) {
    this.handlers = {
      onNext: () => {},
      onOption: () => {},
      onPinchVisual: () => {},
      ...handlers,
    };

    /** trạng thái riêng của từng bàn tay: key ('Left'/'Right') → { active, latched, lastSeen } */
    this.handStates = new Map();

    /* trạng thái tổng hợp để UI hiển thị */
    this.active = { A: false, B: false, C: false, D: false, NEXT: false };
    this.latched = { A: false, B: false, C: false, D: false, NEXT: false };
    this.lastFire = { A: 0, B: 0, C: 0, D: 0, NEXT: 0 };

    this.armedAt = 0;
    this.visibleSince = 0;
    this._globalCooldownUntil = 0;

    /** đếm số khung hình liên tiếp giữ tư thế "một tay chéo ngón" (chỉ khi bật allowOneHandNext) */
    this._poseFrames = 0;
    /** đếm số khung hình liên tiếp thấy cả 2 tay giơ lên */
    this._handsFrames = 0;
    /** số khung hình liên tiếp KHÔNG còn tư thế / không còn 2 tay */
    this._nextOffFrames = 0;

    this.frameMs = 33;
    this.lastUpdateAt = 0;

    this.debug = {
      ratios: { A: 1, B: 1, C: 1, D: 1 },
      scores: { A: 1, B: 1, C: 1, D: 1 },
      hands: 0,
      pose: { fingers: [], gap: 1, active: false, twoHands: false },
      winner: null,
      fired: [],
      chordCount: { A: 0, B: 0, C: 0, D: 0, NEXT: 0 },
    };
  }

  reset() {
    this.handStates.clear();
    Object.keys(this.active).forEach((k) => {
      this.active[k] = false;
      this.latched[k] = false;
    });
    this.visibleSince = 0;
    this._poseFrames = 0;
    this._handsFrames = 0;
    this._nextOffFrames = 0;
    this.lastFire = { A: 0, B: 0, C: 0, D: 0, NEXT: 0 };
    this._globalCooldownUntil = 0;
  }

  /** Trạng thái riêng cho một bàn tay (tạo mới nếu chưa có). */
  _state(key) {
    if (!this.handStates.has(key)) {
      this.handStates.set(key, {
        active: EMPTY_CHORD_ACTIVE(),
        latched: EMPTY_CHORD_LATCH(),
        lastSeen: 0,
      });
    }
    return this.handStates.get(key);
  }

  _expireStates(now) {
    this.handStates.forEach((state, key) => {
      if (now - state.lastSeen > HAND_TTL_MS) this.handStates.delete(key);
    });
  }

  /**
   * Gọi mỗi khung hình.
   * @param {Array|null} landmarks tay chính (giữ tương thích với bản cũ)
   * @param {number} now
   * @param {{hands?: Array<{label:string, landmarks:Array}>, handsCount?: number, twoHandsUp?: boolean}} meta
   */
  update(landmarks, now = performance.now(), meta = {}) {
    const inputs = this._normalizeHands(landmarks, meta);
    if (!inputs.length) {
      this._dropHand();
      return;
    }

    if (!this.visibleSince) {
      this.visibleSince = now;
      this.armedAt = now; // bỏ qua cử chỉ ngay khi tay vừa vào khung
    }

    if (this.lastUpdateAt) {
      const dt = Math.min(400, now - this.lastUpdateAt);
      this.frameMs = this.frameMs * 0.8 + dt * 0.2;
    }
    this.lastUpdateAt = now;

    // Hai tay cùng giơ lên → chỉ để chuyển trang, không đoán đáp án
    const twoHandsUp = Boolean(meta.twoHandsUp);
    const twoHandsSeen = (meta.handsCount ?? inputs.length) >= 2;
    this._updateHands(twoHandsUp);

    // --- cử chỉ chạm ngón trên TỪNG bàn tay
    const candidates = [];
    inputs.forEach((hand, index) => {
      const state = this._state(hand.key || `#${index}`);
      state.lastSeen = now;
      const result = this._evalHand(hand.landmarks, state, { twoHandsUp });
      if (result) candidates.push(result);
    });
    this._expireStates(now);

    // số liệu hiển thị lấy theo bàn tay chính (tay đầu tiên)
    this.debug.hands = inputs.length;
    if (candidates.length) {
      this.debug.ratios = candidates[0].ratios;
      this.debug.scores = candidates[0].scores;
    }

    // --- trạng thái tổng hợp cho UI (chip sáng nếu tay nào đang chạm)
    const merged = EMPTY_CHORD_ACTIVE();
    inputs.forEach((hand, index) => {
      const state = this.handStates.get(hand.key || `#${index}`);
      if (!state) return;
      Object.keys(merged).forEach((k) => {
        merged[k] = merged[k] || state.active[k];
      });
    });
    Object.assign(this.active, merged);

    // --- chọn người thắng: cặp rõ ràng nhất trong các tay
    candidates.sort((x, y) => x.score - y.score);
    const chordWinner = candidates[0] || null;
    this.debug.winner = chordWinner?.action || null;

    // --- chuyển trang (2 tay / tư thế 1 tay nếu bật)
    this._updateRaise(inputs[0].landmarks, chordWinner, twoHandsUp, twoHandsSeen);
    const winner = chordWinner ? chordWinner.chord : this.active.NEXT ? NEXT : null;

    const fired = this._fire(winner, chordWinner, now);

    this.debug.fired = fired ? [fired] : [];
    this.handlers.onPinchVisual({
      ratios: this.debug.ratios,
      scores: this.debug.scores,
      hands: inputs.length,
      active: { ...this.active },
      winner: winner?.action || null,
      fired,
    });
  }

  /** Chuẩn hoá đầu vào: luôn trả về mảng [{key, landmarks}] (hỗ trợ cả API 1 tay cũ). */
  _normalizeHands(landmarks, meta = {}) {
    const list = Array.isArray(meta.hands) && meta.hands.length ? meta.hands : null;
    if (list) {
      return list
        .filter((h) => Array.isArray(h?.landmarks) && h.landmarks.length >= 21)
        .map((h, i) => ({ key: h.label || `#${i}`, landmarks: h.landmarks }));
    }
    if (Array.isArray(landmarks) && landmarks.length >= 21) {
      return [{ key: 'single', landmarks }];
    }
    return [];
  }

  _dropHand() {
    this.visibleSince = 0;
    this.handStates.forEach((state) => {
      Object.keys(state.active).forEach((k) => {
        state.active[k] = false;
        state.latched[k] = false;
      });
    });
    Object.keys(this.active).forEach((k) => {
      this.active[k] = false;
      this.latched[k] = false;
    });
    this._poseFrames = 0;
    this._handsFrames = 0;
    this._nextOffFrames = 0;
    this.debug.pose.active = false;
    this.debug.pose.twoHands = false;
    this.debug.winner = null;
    this.handlers.onPinchVisual({
      ratios: this.debug.ratios,
      scores: this.debug.scores,
      hands: 0,
      active: { ...this.active },
      winner: null,
      fired: null,
    });
  }

  /* ------------------------------------------------------------------ */
  /* CẶP NGÓN CHẠM NGÓN CÁI (A / B / C / D) — đánh giá trên 1 bàn tay    */
  /* ------------------------------------------------------------------ */

  _evalHand(lm, state, { twoHandsUp = false } = {}) {
    const cfg = CONFIG.gestures.chord;
    const size = Math.max(0.02, dist(lm[0], lm[MIDDLE_MCP]));

    const ratios = {};
    const scores = {};
    CHORDS.forEach((c) => {
      ratios[c.action] = dist(lm[c.a], lm[c.b]) / size;
      scores[c.action] = ratios[c.action] / cfg.touchOn;
    });

    // Hysteresis: vào khi < touchOn, ra khi > touchOff
    CHORDS.forEach((c) => {
      const r = ratios[c.action];
      if (!state.active[c.action] && r < cfg.touchOn) {
        state.active[c.action] = true;
      } else if (state.active[c.action] && r > cfg.touchOff) {
        state.active[c.action] = false;
        state.latched[c.action] = false; // đã nhả → lần chạm sau mới tính lại
      }
    });

    // Nếu đang giơ 2 tay thì không đoán đáp án (tránh chọn nhầm khi chuyển trang)
    if (twoHandsUp) return null;

    const candidates = CHORDS.filter((c) => state.active[c.action]).sort(
      (x, y) => scores[x.action] - scores[y.action]
    );
    if (!candidates.length) return null;

    const first = candidates[0];
    const second = candidates[1];
    const clear = !second || scores[first.action] < scores[second.action] * cfg.margin;
    if (!clear) return null;

    return { chord: first, score: scores[first.action], ratios, scores, state, lm };
  }

  /* ------------------------------------------------------------------ */
  /* GIƠ TAY (chuyển trang)                                             */
  /* ------------------------------------------------------------------ */

  /** Một ngón có đang duỗi thẳng không (đầu ngón xa cổ tay hơn khớp giữa). */
  _extended(lm, tip, pip) {
    return dist(lm[0], lm[tip]) > dist(lm[0], lm[pip]) * 1.12;
  }

  /** Đếm số khung hình liên tiếp thấy cả 2 tay giơ lên. */
  _updateHands(twoHandsUp) {
    if (twoHandsUp) {
      this._handsFrames += 1;
    } else if (this._handsFrames > 0) {
      this._handsFrames = Math.max(0, this._handsFrames - 1);
    }
  }

  _updateRaise(lm, chordWinner, twoHandsUp = false, twoHandsSeen = false) {
    const indexUp = this._extended(lm, TIP.index, PIP.index);
    const middleUp = this._extended(lm, TIP.middle, PIP.middle);
    const ringUp = this._extended(lm, TIP.ring, PIP.ring);
    const pinkyUp = this._extended(lm, TIP.pinky, PIP.pinky);

    const knuckles = Math.max(0.02, dist(lm[5], lm[MIDDLE_MCP]));
    const gap = dist(lm[TIP.index], lm[TIP.middle]) / knuckles;

    // Tư thế: trỏ + giữa duỗi và bắt chéo/sát nhau, áp út + út gập, ngón cái không chạm ngón nào
    // (mặc định TẮT — chỉ bật khi CONFIG.gestures.allowOneHandNext = true)
    const pose =
      CONFIG.gestures.allowOneHandNext === true &&
      !twoHandsSeen &&
      indexUp &&
      middleUp &&
      !ringUp &&
      !pinkyUp &&
      gap < 1.15 &&
      !chordWinner &&
      !this.active.A &&
      !this.active.B &&
      !this.active.C &&
      !this.active.D;

    this.debug.pose = {
      fingers: [indexUp, middleUp, ringUp, pinkyUp],
      gap: Math.round(gap * 100) / 100,
      active: pose,
      twoHands: twoHandsUp,
    };

    if (pose) this._poseFrames += 1;
    else if (this._poseFrames > 0) this._poseFrames = Math.max(0, this._poseFrames - 1);

    // "Giơ 2 tay" cần 3 khung hình liên tiếp; tư thế 1 tay (nếu bật) cần 2
    const poseReady = this._poseFrames >= POSE_FRAMES;
    const handsReady = this._handsFrames >= HANDS_FRAMES;
    const ready = poseReady || handsReady;

    if (ready) {
      this._nextOffFrames = 0;
      this.active.NEXT = true;
    } else {
      this._nextOffFrames += 1;
      if (this._nextOffFrames >= POSE_FRAMES) {
        if (this.active.NEXT) {
          this.active.NEXT = false;
          this.latched.NEXT = false; // hạ tay → lần giơ sau mới tính lại
        }
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* KÍCH HOẠT                                                          */
  /* ------------------------------------------------------------------ */

  _fire(winner, chordWinner, now) {
    if (!winner) return null;

    // khoá chống lặp: của riêng bàn tay đó (với A–D) hoặc khoá chung (NEXT)
    const latched = chordWinner ? chordWinner.state.latched[winner.action] : this.latched.NEXT;
    if (latched) return null;

    const cfg = CONFIG.gestures.chord;
    const lastFired = this.lastFire[winner.action] || 0;
    const ready =
      now - lastFired >= cfg.cooldownMs &&
      now - this.armedAt >= cfg.warmupMs &&
      now >= (this._globalCooldownUntil || 0);
    if (!ready) return null;

    if (chordWinner) chordWinner.state.latched[winner.action] = true;
    else this.latched.NEXT = true;

    this._globalCooldownUntil = now + cfg.cooldownMs;
    this.lastFire[winner.action] = now;
    this.debug.chordCount[winner.action] += 1;

    if (chordWinner) {
      // số liệu hiển thị lấy theo bàn tay vừa kích hoạt
      this.debug.ratios = chordWinner.ratios;
      this.debug.scores = chordWinner.scores;
    }

    if (winner.action === 'NEXT') {
      this.handlers.onNext({ source: 'hand', chord: winner.label });
    } else {
      this.handlers.onOption(winner.action, {
        type: 'touch',
        chord: winner.label,
        action: winner.action,
        ratio: chordWinner?.ratios?.[winner.action],
      });
    }
    return winner.action;
  }
}
