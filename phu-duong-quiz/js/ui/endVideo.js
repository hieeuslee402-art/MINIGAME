/**
 * ui/endVideo.js
 * Lớp phủ phát video kết thúc (end/outro.mp4) toàn màn hình khi búng tay.
 * - Không có file → báo nhẹ và chuyển tới slide kết thúc (bảng đáp án).
 * - Đóng bằng nút ĐÓNG, phím Esc, hoặc khi video chạy hết.
 */
export class EndVideo {
  constructor({ root, video, closeBtn, media = null, onOpen = () => {}, onClose = () => {}, onMissing = () => {} } = {}) {
    this.root = root;
    this.video = video;
    this.closeBtn = closeBtn;
    this.media = media;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.onMissing = onMissing;
    this.isOpen = false;
    this.available = null; // null = chưa kiểm tra, true/false sau khi kiểm tra

    this._bind();
  }

  _bind() {
    if (!this.root) return;
    this.closeBtn?.addEventListener('click', () => this.close());
    this.root.addEventListener('click', (event) => {
      // bấm vào nền (không phải nút) cũng đóng
      if (event.target === this.root) this.close();
    });
    this.video?.addEventListener('ended', () => this.close());
    this.video?.addEventListener('error', () => {
      if (this.isOpen) {
        console.warn('[endVideo] lỗi phát video:', this.video?.error?.code, this.video?.currentSrc?.slice(0, 40));
        this.close();
        this.onMissing('Không phát được video — kiểm tra file end/outro.mp4');
      }
    });
  }

  /** Kiểm tra xem đã có file video chưa. */
  async prepare() {
    if (!this.media) return false;
    await this.media.resolve();
    const url = this.media.videoUrl;
    this.available = Boolean(url);
    if (url && this.video && this.video.getAttribute('src') !== url) {
      this.video.setAttribute('src', url);
      this.video.load?.();
    }
    return this.available;
  }

  /** Mở và phát video. Trả về false nếu chưa có file. */
  async open() {
    if (this.isOpen) return true;

    if (this.available === null) await this.prepare();
    if (!this.available) {
      this.onMissing('Chưa có file <b>end/outro.mp4</b> — hãy thêm video vào thư mục end');
      return false;
    }

    this.isOpen = true;
    this.root.hidden = false;
    document.body.classList.add('is-endvideo');
    this.onOpen();

    // toàn màn hình (nếu trình duyệt cho phép)
    try {
      if (!document.fullscreenElement && this.root.requestFullscreen) {
        await this.root.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
      }
    } catch (err) {
      /* bỏ qua */
    }

    try {
      this.video.currentTime = 0;
      const p = this.video.play();
      if (p?.catch) p.catch(() => {});
    } catch (err) {
      /* bỏ qua */
    }
    this.closeBtn?.focus?.();
    return true;
  }

  /** Phát lại từ đầu (búng tay lần nữa khi video đang chiếu). */
  replay() {
    if (!this.isOpen) return false;
    try {
      this.video.currentTime = 0;
      const p = this.video.play();
      if (p?.catch) p.catch(() => {});
    } catch (err) {
      /* bỏ qua */
    }
    return true;
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    try {
      this.video?.pause?.();
    } catch (err) {
      /* bỏ qua */
    }
    this.root.hidden = true;
    document.body.classList.remove('is-endvideo');
    if (document.fullscreenElement === this.root) {
      document.exitFullscreen?.().catch(() => {});
    }
    this.onClose();
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }
}
