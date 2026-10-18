/**
 * core/snapDetector.js
 * Nhận tiếng BÚNG TAY qua micro để phát video kết thúc.
 *
 * Vì sao dùng micro: búng tay là âm thanh, không phải tư thế tay — mô hình bàn tay
 * không nhận ra được. Detector này nghe khung âm thanh rất ngắn (~12 ms/lần) và tìm
 * một xung nhọn, giàu âm cao (tiếng "tách") nổi bật hẳn trên tạp âm nền.
 *
 * Có 2 lớp:
 *   - detectSnap(): hàm thuần, dễ kiểm thử bằng số liệu giả.
 *   - SnapDetector: lấy micro → AudioWorklet (hoặc ScriptProcessor dự phòng) → gọi onSnap.
 */

export const SNAP_DEFAULTS = {
  /** hai lần búng phải cách nhau ít nhất chừng này (ms) */
  minIntervalMs: 320,
  /** xung phải mạnh hơn tạp âm nền bao nhiêu lần (âm cao) */
  hfRatio: 5,
  /** ... và mạnh hơn nền bao nhiêu lần (toàn dải) */
  rmsRatio: 2.6,
  /** sàn tuyệt đối để không nhận nhầm khi phòng rất yên tĩnh */
  hfAbs: 0.006,
  rmsAbs: 0.004,
  /** tiếng búng giàu âm cao: năng lượng cao tần ≥ tỉ lệ này so với toàn dải */
  hfVsRms: 0.55,
};

/**
 * Quyết định một khung âm thanh có phải tiếng búng tay không.
 * @param {{hf:number, rms:number, hfFloor:number, rmsFloor:number, sinceLast:number}} m
 * @param {object} cfg
 */
export function detectSnap(m, cfg = {}) {
  const c = { ...SNAP_DEFAULTS, ...cfg };
  const { hf = 0, rms = 0, hfFloor = 0, rmsFloor = 0, sinceLast = Infinity } = m || {};

  if (sinceLast < c.minIntervalMs) return false;
  if (!(hf > 0) || !(rms > 0)) return false;

  // nổi bật trên nền (dùng tỉ lệ, có sàn tuyệt đối để phòng yên tĩnh)
  const hfOk = hf > Math.max(hfFloor * c.hfRatio, c.hfAbs);
  const rmsOk = rms > Math.max(rmsFloor * c.rmsRatio, c.rmsAbs);
  // xung nhọn, giàu âm cao (giọng nói/tiếng ồn ít cao tần hơn nhiều)
  const sharp = hf >= rms * c.hfVsRms;

  return hfOk && rmsOk && sharp;
}

/** Cập nhật "mức nền" một cách chậm rãi (nền tăng nhanh, giảm chậm). */
export function updateFloor(floor, value, cfg = {}) {
  const up = cfg.floorUp ?? 0.25;
  const down = cfg.floorDown ?? 0.004;
  if (!Number.isFinite(floor) || floor <= 0) return Math.max(value, 1e-5);
  const k = value > floor ? up : down;
  return floor + (value - floor) * k;
}

/** Mã xử lý trong AudioWorklet: gửi mức toàn dải + năng lượng cao tần mỗi ~12 ms. */
export const WORKLET_CODE = `
class SnapMeter extends AudioWorkletProcessor {
  constructor() {
    super();
    this.accRms = 0;
    this.accHf = 0;
    this.accPeak = 0;
    this.count = 0;
  }
  process(inputs) {
    const input = inputs[0];
    const ch = input && input[0];
    if (!ch) return true;
    let sum = 0;
    let hf = 0;
    let peak = 0;
    for (let i = 0; i < ch.length; i += 1) {
      const x = ch[i];
      const d = x - (i ? ch[i - 1] : x); // đạo hàm bậc 1 ≈ lọc thông cao
      sum += x * x;
      hf += d * d;
      const a = Math.abs(x);
      if (a > peak) peak = a;
    }
    this.accRms += sum;
    this.accHf += hf;
    this.accPeak = Math.max(this.accPeak, peak);
    this.count += ch.length;
    // gửi mỗi ~512 mẫu (≈11,6 ms ở 44,1 kHz)
    if (this.count >= 512) {
      const rms = Math.sqrt(this.accRms / this.count);
      const hfRms = Math.sqrt(this.accHf / this.count) * 0.5;
      this.port.postMessage({ rms, hf: hfRms, peak: this.accPeak });
      this.accRms = 0;
      this.accHf = 0;
      this.accPeak = 0;
      this.count = 0;
    }
    return true;
  }
}
registerProcessor('snap-meter', SnapMeter);
`;

export class SnapDetector {
  constructor({ onSnap = () => {}, onError = () => {}, config = {} } = {}) {
    this.onSnap = onSnap;
    this.onError = onError;
    this.config = { ...SNAP_DEFAULTS, ...config };
    this.stream = null;
    this.ctx = null;
    this.node = null;
    this.source = null;
    this.active = false;
    this.supported = Boolean(
      typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia
    );
    this._lastSnapAt = 0;
    this._hfFloor = 0;
    this._rmsFloor = 0;
    this._lastLevel = { hf: 0, rms: 0 };
    this._started = false;
  }

  /** Số liệu gần nhất (để hiển thị/chẩn đoán). */
  get level() {
    return { ...this._lastLevel, hfFloor: this._hfFloor, rmsFloor: this._rmsFloor };
  }

  async start() {
    if (!this.supported) {
      this.onError(new Error('Trình duyệt không hỗ trợ micro'));
      return false;
    }
    if (this.active) return true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
        video: false,
      });
    } catch (err) {
      this.onError(err);
      return false;
    }

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      this.onError(new Error('Trình duyệt không hỗ trợ Web Audio'));
      return false;
    }
    const ctx = new Ctx();
    this.ctx = ctx;
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

    this.source = ctx.createMediaStreamSource(this.stream);
    const ok = await this._useWorklet(ctx);
    if (!ok) this._useScriptProcessor(ctx);

    this.active = true;
    this._started = true;
    return true;
  }

  async _useWorklet(ctx) {
    if (!ctx.audioWorklet?.addModule) return false;
    try {
      const url = URL.createObjectURL(new Blob([WORKLET_CODE], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const node = new AudioWorkletNode(ctx, 'snap-meter');
      node.port.onmessage = (event) => this._onMeter(event.data);
      this.source.connect(node);
      // Không nối tới destination để không nghe lại chính mình (và tránh vòng lặp âm thanh)
      this.node = node;
      return true;
    } catch (err) {
      return false;
    }
  }

  _useScriptProcessor(ctx) {
    try {
      const node = ctx.createScriptProcessor(512, 1, 1);
      let prev = 0;
      node.onaudioprocess = (event) => {
        const data = event.inputBuffer.getChannelData(0);
        let sum = 0;
        let hf = 0;
        let peak = 0;
        for (let i = 0; i < data.length; i += 1) {
          const x = data[i];
          const d = x - (i ? data[i - 1] : prev || x);
          sum += x * x;
          hf += d * d;
          peak = Math.max(peak, Math.abs(x));
        }
        prev = data[data.length - 1];
        const n = data.length;
        this._onMeter({
          rms: Math.sqrt(sum / n),
          hf: Math.sqrt(hf / n) * 0.5,
          peak,
        });
      };
      this.source.connect(node);
      // ScriptProcessor chỉ chạy khi được nối tới destination → nối qua gain 0
      const mute = ctx.createGain();
      mute.gain.value = 0;
      node.connect(mute).connect(ctx.destination);
      this.node = node;
    } catch (err) {
      this.onError(err);
    }
  }

  _onMeter({ rms = 0, hf = 0 } = {}) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const sinceLast = now - (this._lastSnapAt || 0);

    this._lastLevel = { hf, rms };
    const isSnap = detectSnap(
      { hf, rms, hfFloor: this._hfFloor, rmsFloor: this._rmsFloor, sinceLast },
      this.config
    );

    // cập nhật nền SAU khi quyết định để tiếng búng không bị coi là nền
    if (!isSnap) {
      this._hfFloor = updateFloor(this._hfFloor, hf, this.config);
      this._rmsFloor = updateFloor(this._rmsFloor, rms, this.config);
    }

    if (isSnap) {
      this._lastSnapAt = now;
      this.onSnap({ at: now, hf, rms });
    }
  }

  stop() {
    this.active = false;
    try {
      this.node?.port && (this.node.port.onmessage = null);
      this.node?.disconnect?.();
      this.source?.disconnect?.();
    } catch (err) {
      /* bỏ qua */
    }
    try {
      this.ctx?.close?.();
    } catch (err) {
      /* bỏ qua */
    }
    this.stream?.getTracks?.().forEach((t) => t.stop());
    this.stream = null;
    this.node = null;
    this.source = null;
    this.ctx = null;
  }
}
