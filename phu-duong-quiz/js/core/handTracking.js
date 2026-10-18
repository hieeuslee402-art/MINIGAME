/**
 * core/handTracking.js
 * Bọc MediaPipe Hands: mở camera, chạy mô hình, phát sự kiện landmark.
 *
 * Điểm quan trọng của bản này (để camera "không hoạt động" không còn xảy ra):
 *   1. Gửi khung hình KHÔNG chờ (non-blocking): một promise bị treo không thể làm
 *      đứng cả vòng lặp nhận diện.
 *   2. Dùng canvas trung gian 640px: ổn định hơn khi truyền thẳng thẻ <video>,
 *      đồng thời nhẹ CPU.
 *   3. Tự phục hồi: nếu quá 6 giây không có kết quả → huỷ và tạo lại mô hình;
 *      nếu thấy hình nhưng 5 giây không thấy tay → tự tăng độ chính xác + hạ ngưỡng.
 *   4. Có thể "chụp thử" một khung hình bất kỳ để kiểm tra nhận diện (dùng cho
 *      bảng chẩn đoán).
 */
import { CONFIG } from '../config.js';
import { LandmarkSmoother } from '../utils/math.js';
import { pickValidHands, twoHandsRaised } from './handFilter.js';

const VENDOR_PATH = 'assets/vendor/mediapipe/hands';
const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240';

export class HandTracker {
  constructor() {
    this.hands = null;
    this.video = null;
    this.stream = null;
    this.running = false;
    this.ready = false;
    this.modelSource = null; // 'local' | 'cdn'
    this.smoother = new LandmarkSmoother(CONFIG.hand.smootherAlpha ?? 0.72);
    /** mỗi bàn tay (theo nhãn trái/phải) có bộ làm mượt riêng để không trộn toạ độ */
    this.smoothers = new Map();
    this.listeners = new Map();

    this.lastLandmarks = null;
    /** các bàn tay đang thấy (mỗi phần tử { label, landmarks }) — khác với this.hands (mô hình MediaPipe) */
    this.detectedHands = [];
    this.lastSeenAt = 0;
    this.detectedLabel = null;

    this.stats = {
      framesSent: 0,
      framesWithHand: 0,
      handsCount: 0,
      handsRaw: 0,
      handsRejected: 0,
      twoHandsUp: false,
      fps: 0,
      inferenceMs: 0,
      lastResultAt: 0,
      lastHandAt: 0,
      sendStalled: false,
      recoveries: 0,
      errors: [],
      cameraError: null,
      modelError: null,
    };

    this._loopBound = this._loop.bind(this);
    this._lastSentAt = 0;
    this._fpsWindow = [];
    this._sending = false;
    this._sendStartedAt = 0;
    this._firstSendAt = 0;
    this._lastHealthAt = 0;
    this._noHandSince = 0;
    this._lastRecoveryAt = 0;
    this._lowFpsSince = 0;
    this._lastAdaptAt = 0;

    // canvas trung gian để đưa khung hình vào mô hình
    this._input = document.createElement('canvas');
    this._inputCtx = this._input.getContext('2d');
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  _emit(event, detail) {
    this.listeners.get(event)?.forEach((fn) => {
      try {
        fn(detail);
      } catch (err) {
        console.error(`[handTracker] listener "${event}" lỗi:`, err);
      }
    });
  }

  /* --------------------------------------------------------------- camera */

  async startCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw Object.assign(new Error('Trình duyệt không hỗ trợ truy cập camera.'), {
        code: 'unsupported',
      });
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: CONFIG.camera.width },
        height: { ideal: CONFIG.camera.height },
      },
    });

    this.video = document.getElementById('video');
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.setAttribute('playsinline', '');

    try {
      await this.video.play();
    } catch (err) {
      this.video.addEventListener('loadeddata', () => this.video.play().catch(() => {}), {
        once: true,
      });
    }

    await new Promise((resolve) => {
      if (this.video.readyState >= 2) return resolve();
      const done = () => resolve();
      this.video.onloadedmetadata = done;
      this.video.oncanplay = done;
      setTimeout(done, 2000);
    });

    this.stats.cameraError = null;
    return this.stream;
  }

  cameraInfo() {
    const track = this.stream?.getVideoTracks?.()[0];
    const settings = track?.getSettings?.() || {};
    return {
      active: Boolean(this.stream?.active),
      label: track?.label || '',
      width: settings.width || this.video?.videoWidth || 0,
      height: settings.height || this.video?.videoHeight || 0,
      readyState: this.video?.readyState ?? 0,
    };
  }

  /* ---------------------------------------------------------------- model */

  async _injectScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Không tải được ${src}`));
      document.head.appendChild(script);
    });
  }

  async _ensureLibrary() {
    if (window.Hands) {
      this.modelSource = this.modelSource || 'local';
      return;
    }
    try {
      await this._injectScript(`${VENDOR_PATH}/hands.js`);
      this.modelSource = 'local';
    } catch (err) {
      this.stats.errors.push(`Local model: ${err.message}`);
      this._emit('modelStatus', { text: 'Bản offline lỗi — đang thử máy chủ dự phòng…' });
      try {
        await this._injectScript(`${CDN_BASE}/hands.js`);
        this.modelSource = 'cdn';
      } catch (cdnErr) {
        this.stats.errors.push(`CDN model: ${cdnErr.message}`);
        throw Object.assign(new Error('Không tải được thư viện MediaPipe (cả bản offline và CDN).'), {
          code: 'model',
        });
      }
    }
  }

  _currentOptions() {
    return {
      maxNumHands: CONFIG.hand.maxNumHands,
      modelComplexity: CONFIG.hand.modelComplexity,
      minDetectionConfidence: CONFIG.hand.minDetectionConfidence,
      minTrackingConfidence: CONFIG.hand.minTrackingConfidence,
      selfieMode: false,
      // Sau khi WebGL lỗi nhiều lần, chuyển sang suy luận bằng CPU cho chắc.
      ...(CONFIG.hand.forceCpu ? { useCpuInference: true } : {}),
    };
  }

  /** Tạo thực thể Hands mới (dùng chung cho lần đầu và khi tự phục hồi). */
  async _buildHands() {
    await this._ensureLibrary();
    const Hands = window.Hands;
    if (!Hands) throw Object.assign(new Error('Thiếu thư viện MediaPipe'), { code: 'model' });

    if (this.hands) {
      try {
        await this.hands.close?.();
      } catch (e) {
        /* bỏ qua */
      }
      this.hands = null;
    }

    const base = this.modelSource === 'cdn' ? CDN_BASE : VENDOR_PATH;
    const hands = new Hands({ locateFile: (file) => `${base}/${file}` });
    hands.setOptions(this._currentOptions());
    hands.onResults((results) => this._handleResults(results));
    this.hands = hands;
    this.ready = true;
    this.stats.modelError = null;
    this._noHandSince = 0;
    return hands;
  }

  async loadModel() {
    if (this.ready) return;
    this._emit('modelStatus', { text: 'Đang nạp mô hình nhận diện bàn tay…', source: null });
    try {
      await this._buildHands();
      this._emit('modelStatus', {
        text: 'Mô hình đã sẵn sàng',
        source: this.modelSource,
      });
    } catch (err) {
      this.stats.modelError = err.message;
      throw Object.assign(new Error(`Mô hình MediaPipe lỗi: ${err.message}`), { code: 'model' });
    }
  }

  async setModelComplexity(level) {
    CONFIG.hand.modelComplexity = level;
    if (!this.hands) return;
    try {
      this.hands.setOptions(this._currentOptions());
      this._emit('modelStatus', { text: `Đã đổi mô hình sang độ phức tạp ${level}` });
    } catch (err) {
      this.stats.errors.push(`setOptions: ${err.message}`);
    }
  }

  setTrackingHand(hand) {
    CONFIG.hand.trackedHand = hand;
    this.smoother.reset();
    this.smoothers.forEach((sm) => sm.reset());
    this._emit('trackedHand', hand);
  }

  /* ------------------------------------------------------------- vòng lặp */

  async start() {
    if (this.running) return;
    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
  }

  /** Vẽ khung hình camera vào canvas 640px rồi trả canvas đó cho mô hình. */
  _grabInput() {
    const video = this.video;
    const vw = video?.videoWidth || 0;
    const vh = video?.videoHeight || 0;
    if (!vw || !vh) return null;

    if (!CONFIG.hand.useCanvasInput) return video;

    const targetW = Math.min(CONFIG.hand.inputWidth, vw);
    const targetH = Math.round((targetW / vw) * vh);
    if (this._input.width !== targetW || this._input.height !== targetH) {
      this._input.width = targetW;
      this._input.height = targetH;
    }

    // Tăng sáng nhẹ: camera laptop thường tối, mô hình rất "khó tính" với ảnh thiếu sáng.
    const enh = CONFIG.hand.enhance;
    const canFilter = typeof this._inputCtx.filter === 'string';
    if (enh?.enabled && canFilter) {
      this._inputCtx.filter = `brightness(${enh.brightness}) contrast(${enh.contrast}) saturate(${enh.saturate})`;
    }
    this._inputCtx.drawImage(video, 0, 0, targetW, targetH);
    if (enh?.enabled && canFilter) this._inputCtx.filter = 'none';

    return this._input;
  }

  async _loop() {
    if (!this.running) return;
    const now = performance.now();
    const maxFps = CONFIG.camera.maxFps || 0;
    const interval = maxFps > 0 ? 1000 / Math.min(CONFIG.camera.fps, maxFps) : 0;
    const video = this.video;

    if (video && video.readyState >= 2 && this.hands) {
      // --- theo dõi vòng lặp gửi có bị treo không
      if (this._sending && now - this._sendStartedAt > (CONFIG.hand.sendTimeoutMs || 2500)) {
        this._sending = false;
        this.stats.sendStalled = true;
        this._recover('send-timeout');
      }

      if (!this._sending && now - this._lastSentAt >= interval) {
        this._lastSentAt = now;
        const image = this._grabInput();
        if (image) {
          this._sending = true;
          this._sendStartedAt = now;
          if (!this._firstSendAt) this._firstSendAt = now;
          const t0 = now;
          this.hands
            .send({ image })
            .then(() => {
              this.stats.framesSent += 1;
              this.stats.inferenceMs = Math.round(performance.now() - t0);
              this.stats.sendStalled = false;
              this._fpsWindow.push(performance.now());
              while (this._fpsWindow.length && performance.now() - this._fpsWindow[0] > 2000) {
                this._fpsWindow.shift();
              }
              this.stats.fps = Math.round((this._fpsWindow.length / 2) * 10) / 10;
            })
            .catch((err) => {
              this.stats.errors.push(`send: ${err.message}`);
              if (this.stats.errors.length > 20) this.stats.errors.shift();
              console.warn('[handTracker] send lỗi:', err);
            })
            .finally(() => {
              this._sending = false;
            });
        }
      }

      this._healthCheck(now);
    }

    requestAnimationFrame(this._loopBound);
  }

  /**
   * Máy yếu: nếu FPS đo được cứ thấp hơn ~18 trong hơn 2,5 giây thì hạ độ phân giải
   * khung đưa vào mô hình từng bước 64px (sàn minInputWidth) để kéo FPS lên gần 30.
   */
  _adaptQuality(now) {
    if (!CONFIG.hand.adaptiveInput) return;
    const fps = this.stats.fps;
    if (this.stats.framesSent < 30 || !fps) return;

    if (fps < 18) {
      if (!this._lowFpsSince) this._lowFpsSince = now;
      const lowFor = now - this._lowFpsSince;
      const width = CONFIG.hand.inputWidth;
      const floor = CONFIG.hand.minInputWidth || 256;

      if (lowFor > 2500 && width > floor && now - this._lastAdaptAt > 2500) {
        this._lastAdaptAt = now;
        this._lowFpsSince = now;
        CONFIG.hand.inputWidth = Math.max(floor, width - 64);
        this.stats.inputWidth = CONFIG.hand.inputWidth;
        this.stats.errors.push(`hạ độ phân giải → ${CONFIG.hand.inputWidth}px để tăng FPS`);
        if (this.stats.errors.length > 20) this.stats.errors.shift();
      }
    } else {
      this._lowFpsSince = 0;
    }
  }

  /** Phát sự kiện sức khoẻ + tự phục hồi khi mô hình "im lặng". */
  _healthCheck(now) {
    this._adaptQuality(now);

    if (now - this._lastHealthAt > 700) {
      this._lastHealthAt = now;
      this._emit('health', {
        ...this.stats,
        ready: this.ready,
        modelSource: this.modelSource,
      });
    }

    if (!this.running) return;

    // Có gửi khung hình nhưng không hề có kết quả trả về → mô hình treo/GL lỗi.
    const since = this.stats.lastResultAt || this._firstSendAt || now;
    const silence = now - since;
    if (this._firstSendAt && silence > (CONFIG.hand.deadAfterMs || 8000)) {
      this._recover('silent-model');
      return;
    }

    // Có kết quả nhưng không thấy tay: nâng dần khả năng nhận diện.
    if (this.stats.framesSent > 15 && !this.lastSeenAt) {
      if (!this._noHandSince) this._noHandSince = now;
      const stuckFor = now - this._noHandSince;

      if (stuckFor > 4000 && CONFIG.hand.modelComplexity === 0) {
        this.setModelComplexity(1);
        this._noHandSince = now;
      } else if (stuckFor > 6000 && CONFIG.hand.minDetectionConfidence > 0.32) {
        CONFIG.hand.minDetectionConfidence = 0.32;
        CONFIG.hand.minTrackingConfidence = 0.3;
        this.hands?.setOptions(this._currentOptions());
        this._noHandSince = now;
        this._emit('needGuidance', { reason: 'low-confidence' });
      }
    } else if (this.lastSeenAt) {
      this._noHandSince = 0;
    }
  }

  /** Tự phục hồi: tạo lại mô hình (tối đa vài lần, giãn cách 4 giây). */
  async _recover(reason = 'unknown') {
    const now = performance.now();
    if (now - this._lastRecoveryAt < 4000) return;
    if (this.stats.recoveries >= 3) return;
    this._lastRecoveryAt = now;
    this.stats.recoveries += 1;
    this.stats.errors.push(`recover(${reason}) #${this.stats.recoveries}`);
    this._emit('recovering', { reason, count: this.stats.recoveries });
    this._sending = false;
    // Lần phục hồi thứ 2 trở đi: thử suy luận bằng CPU (một số GPU/trình điều khiển cũ
    // làm MediaPipe trả về rỗng dù camera vẫn chạy).
    if (this.stats.recoveries >= 2 && !CONFIG.hand.forceCpu) {
      CONFIG.hand.forceCpu = true;
      this.stats.errors.push('chuyển sang suy luận CPU');
    }
    try {
      await this._buildHands();
      this._lastSentAt = 0;
    } catch (err) {
      this.stats.modelError = err.message;
      console.warn('[handTracker] phục hồi thất bại:', err);
    }
  }

  _handleResults(results) {
    const list = results?.multiHandLandmarks || [];
    const handedness = results?.multiHandedness || [];
    this.stats.lastResultAt = performance.now();
    this.stats.handsRaw = list.length;

    // --- Lọc bàn tay ảo (mặt/đồ vật nhận nhầm, bản trùng của cùng một tay)
    const valid = pickValidHands(list, handedness, CONFIG.hand.plausibility || {});
    this.stats.handsCount = valid.length;
    this.stats.handsRejected = Math.max(0, list.length - valid.length);

    // --- "Giơ cả 2 tay": 2 tay hợp lệ, khác tay, cùng giơ lên và cách xa nhau
    this.stats.twoHandsUp = twoHandsRaised(
      valid.filter((h) => h.metrics),
      {
        maxY: CONFIG.hand.bothHandsMaxY ?? 0.72,
        minGap: CONFIG.hand.twoHandsMinGap ?? 0.1,
      }
    );

    // --- Làm mượt riêng cho từng tay để không trộn toạ độ khi đổi tay
    const smoothHands = [];
    valid.forEach((h) => {
      const key = h.label || `#${h.index}`;
      if (!this.smoothers.has(key)) {
        this.smoothers.set(key, new LandmarkSmoother(CONFIG.hand.smootherAlpha ?? 0.72));
      }
      const sm = this.smoothers.get(key);
      smoothHands.push({ label: h.label || null, landmarks: sm.smooth(h.lm) });
    });

    // --- Chọn bàn tay chính (để vẽ khung xương lớn và đọc cử chỉ chạm ngón)
    let primary = null;
    if (smoothHands.length) {
      const wanted = CONFIG.hand.trackedHand;
      if (CONFIG.hand.strictHandedness && wanted !== 'Auto') {
        primary = smoothHands.find((h) => h.label === wanted) || null;
      }
      if (!primary) {
        primary =
          smoothHands.find((h) => h.label === 'Left') ||
          smoothHands.slice().sort((a, b) => b.landmarks.length - a.landmarks.length)[0];
      }
    }

    if (!primary) {
      this.detectedLabel = valid[0]?.label || null;
      this._emit('frame', {
        landmarks: null,
        hands: [],
        handedness: this.detectedLabel,
        handsCount: valid.length,
        twoHandsUp: false,
        now: performance.now(),
      });
      return;
    }

    this.detectedHands = smoothHands; // cả 2 tay (để overlay vẽ và GestureEngine đọc cử chỉ)
    this.lastLandmarks = primary.landmarks;
    this.lastSeenAt = performance.now();
    this.stats.lastHandAt = this.lastSeenAt;
    this.stats.framesWithHand += 1;
    this.detectedLabel = primary.label || null;

    this._emit('frame', {
      landmarks: primary.landmarks,
      rawLandmarks: valid[0]?.lm,
      hands: smoothHands, // cả 2 tay (nếu có) — GestureEngine đọc cử chỉ trên từng tay
      handedness: this.detectedLabel,
      handsCount: valid.length,
      twoHandsUp: this.stats.twoHandsUp,
      now: this.lastSeenAt,
    });
  }

  /* ------------------------------------------------------- kiểm tra nhanh */

  /**
   * Chụp khung hình hiện tại và cho mô hình nhận diện một lần.
   * Dùng cho nút "THỬ NHẬN DIỆN TAY NGAY" trong bảng chẩn đoán.
   */
  async probe() {
    if (!this.hands) {
      return { ok: false, error: 'Mô hình chưa sẵn sàng' };
    }
    const image = this._grabInput();
    if (!image) return { ok: false, error: 'Chưa có khung hình từ camera' };

    const snapshot = document.createElement('canvas');
    snapshot.width = image.width || image.videoWidth;
    snapshot.height = image.height || image.videoHeight;
    snapshot.getContext('2d').drawImage(image, 0, 0, snapshot.width, snapshot.height);

    const result = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 5000);
      this.hands.onResults((r) => {
        clearTimeout(timer);
        resolve(r);
      });
      this.hands.send({ image: snapshot }).catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
    });

    // trả lại handler chuẩn
    this.hands.onResults((results) => this._handleResults(results));

    if (!result) return { ok: false, error: 'Mô hình không trả kết quả (quá 5 giây)', snapshot: snapshot.toDataURL('image/jpeg', 0.7) };

    const count = result.multiHandLandmarks?.length || 0;
    return {
      ok: count > 0,
      count,
      handedness: (result.multiHandedness || []).map(
        (h) => `${h.label} (${Math.round(h.score * 100)}%)`
      ),
      landmarks: count ? result.multiHandLandmarks[0].length : 0,
      snapshot: snapshot.toDataURL('image/jpeg', 0.7),
    };
  }
}
