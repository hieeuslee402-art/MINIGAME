/**
 * core/mediaAssets.js
 * Tìm & phát các file media người dùng tự đặt trong repo:
 *
 *   dung/dung.mp3   → âm thanh khi chọn ĐÚNG
 *   sai/sai.mp3     → âm thanh khi chọn SAI
 *   end/outro.mp4   → video phát toàn màn hình khi búng tay
 *
 * File có thể nằm ở nhiều vị trí (xem SOURCES); vị trí đầu tiên tồn tại sẽ được dùng.
 * Nếu không tìm thấy, `play()` trả về false để nơi gọi tự dùng âm thanh tổng hợp dự phòng.
 */

export const SOURCES = {
  dung: ['dung/dung.mp3', 'dung.mp3', 'assets/audio/dung.mp3', 'sounds/dung.mp3', 'sounds/dung.wav'],
  sai: ['sai/sai.mp3', 'sai.mp3', 'assets/audio/sai.mp3', 'sounds/sai.mp3', 'sounds/sai.wav'],
  video: ['end/outro.mp4', 'outro.mp4', 'assets/video/outro.mp4'],
};

/** Kiểm tra nhanh một URL có tồn tại trên máy chủ không (HEAD, tự thử GET nếu HEAD bị chặn). */
export async function urlExists(url, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') return false;
  try {
    const res = await fetchImpl(url, { method: 'HEAD', cache: 'no-store' });
    if (res?.ok) return true;
    if (res?.status === 405 || res?.status === 501) {
      const get = await fetchImpl(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        cache: 'no-store',
      });
      return Boolean(get?.ok || get?.status === 206);
    }
    return false;
  } catch (err) {
    return false;
  }
}

export class MediaAssets {
  constructor({ sources = SOURCES, fetchImpl = null, AudioCtor = null, base = '', volume = 1 } = {}) {
    this.sources = sources;
    this.volume = volume;
    this.fetchImpl = fetchImpl || globalThis.fetch?.bind(globalThis);
    this.AudioCtor = AudioCtor || globalThis.Audio || null;
    this.base = base;
    this.urls = { dung: null, sai: null, video: null };
    this.players = { dung: null, sai: null };
    this.checked = false;
    this._pending = null;
  }

  _abs(path) {
    if (!path) return path;
    if (/^(https?:|data:|blob:|\/)/.test(path)) return path;
    return `${this.base}${path}`;
  }

  /** Tìm file cho từng loại. Chạy 1 lần; gọi lại sẽ dùng kết quả cũ. */
  async resolve() {
    if (this._pending) return this._pending;
    this._pending = (async () => {
      const next = {};
      await Promise.all(
        Object.entries(this.sources).map(async ([kind, list]) => {
          next[kind] = null;
          for (const path of list) {
            const url = this._abs(path);
            // eslint-disable-next-line no-await-in-loop
            if (await urlExists(url, this.fetchImpl)) {
              next[kind] = url;
              break;
            }
          }
        })
      );
      this.urls = next;
      this.checked = true;
      this._preparePlayers();
      return this.urls;
    })();
    return this._pending;
  }

  _preparePlayers() {
    if (!this.AudioCtor) return;
    ['dung', 'sai'].forEach((kind) => {
      const url = this.urls[kind];
      if (!url) return;
      try {
        const el = new this.AudioCtor(url);
        el.preload = 'auto';
        el.volume = this.volume;
        this.players[kind] = el;
      } catch (err) {
        this.players[kind] = null;
      }
    });
  }

  /** Phát âm thanh đúng/sai. Trả về false nếu không có file → dùng âm tổng hợp. */
  play(kind) {
    const url = this.urls[kind];
    if (!url) return false;
    const player = this.players[kind];
    if (!player) return false;
    try {
      player.currentTime = 0;
      const promise = player.play();
      if (promise?.catch) promise.catch(() => {});
      return true;
    } catch (err) {
      return false;
    }
  }

  get videoUrl() {
    return this.urls.video;
  }

  get status() {
    return {
      checked: this.checked,
      dung: this.urls.dung,
      sai: this.urls.sai,
      video: this.urls.video,
    };
  }
}
