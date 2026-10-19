/**
 * ui/hud.js — thanh tiến độ, điểm số, trạng thái bàn tay, các chip cử chỉ.
 */
import { $, el } from '../utils/dom.js';
import { CONFIG } from '../config.js';


export class Hud {
  constructor({ totalSlides }) {
    this.totalSlides = totalSlides;
    this.fill = $('#progress-fill');
    this.label = $('#progress-label');
    this.dots = $('#progress-dots');
    this.bar = $('#progress');
    this.badge = $('#hand-badge');
    this.statsEl = $('#selfview-stats');
    this.selfview = $('#selfview');
    this.chips = new Map();

    document.querySelectorAll('.gesturebar__chip').forEach((chip) => {
      this.chips.set(chip.dataset.gesture, chip);
    });

    this._buildDots();
  }

  _buildDots() {
    if (!this.dots) return;
    this.dots.innerHTML = '';
    for (let i = 0; i < this.totalSlides; i += 1) {
      this.dots.append(el('i'));
    }
  }

  setSlide(index, total = this.totalSlides, type = '') {
    const human = String(index + 1).padStart(2, '0');
    const all = String(total).padStart(2, '0');
    if (this.label) this.label.textContent = `SLIDE ${human} / ${all}`;
    if (this.fill) this.fill.style.width = `${((index + 1) / total) * 100}%`;
    if (this.bar) {
      this.bar.setAttribute('aria-valuemin', '1');
      this.bar.setAttribute('aria-valuemax', String(total));
      this.bar.setAttribute('aria-valuenow', String(index + 1));
    }
    [...this.dots.children].forEach((dot, i) => {
      dot.classList.toggle('is-done', i < index);
      dot.classList.toggle('is-active', i === index);
    });
    document.body.dataset.slideType = type;
  }

  setScore(score) {
    document.querySelectorAll('[data-score]').forEach((node) => {
      if (node.textContent !== String(score)) {
        node.textContent = score;
        const wrap = node.closest('.q-score');
        if (wrap) {
          wrap.classList.remove('is-bump');
          void wrap.offsetWidth;
          wrap.classList.add('is-bump');
        }
      }
    });
  }

  setHandState({ found, label, hint }) {
    if (!this.badge) return;
    this.badge.classList.toggle('is-live', Boolean(found));
    if (found) {
      this.badge.innerHTML = `<i></i>ĐÃ THẤY ${label || 'BÀN TAY'}`;
    } else {
      this.badge.innerHTML = `<i></i>${hint || 'ĐANG TÌM BÀN TAY…'}`;
    }
  }

  /** Số liệu sống trong khung camera nhỏ: FPS + số khung hình thấy tay. */
  setHealth({ fps = 0, framesWithHand = 0, sendStalled = false, ready = false }) {
    if (!this.statsEl) return;
    let text = `${Math.round(fps)} FPS · ${framesWithHand} KHUNG CÓ TAY`;
    let cls = '';
    if (!ready) {
      text = 'MÔ HÌNH CHƯA SẴN SÀNG';
      cls = 'is-bad';
    } else if (sendStalled) {
      text = 'MÔ HÌNH ĐANG KHỰNG LẠI';
      cls = 'is-bad';
    } else if (fps < 6) {
      cls = 'is-warn';
    }
    this.statsEl.textContent = text;
    this.statsEl.classList.remove('is-warn', 'is-bad');
    if (cls) this.statsEl.classList.add(cls);
  }

  /** Cập nhật các chip theo trạng thái cặp ngón (A/B/C/D chạm, NEXT = giơ cả 2 tay). */
  setPinch({ active = {}, winner = null } = {}) {
    const signature =
      Object.keys(active)
        .map((k) => (active[k] ? 1 : 0))
        .join('') + `|${winner || ''}`;
    if (signature === this._pinchSig) return;
    this._pinchSig = signature;

    Object.entries(active).forEach(([action, on]) => {
      const key = action === 'NEXT' ? 'next' : action;
      this.chips.get(key)?.classList.toggle('is-touch', Boolean(on));
      this.chips.get(key)?.classList.toggle('is-winning', winner === action);
    });
  }

  flashChip(key) {
    const chip = this.chips.get(key);
    if (!chip) return;
    chip.classList.add('is-hot');
    clearTimeout(chip._hotTimer);
    chip._hotTimer = setTimeout(() => chip.classList.remove('is-hot'), 700);
  }

  showSelfview(show) {
    this.selfview?.classList.toggle('is-hidden', !show);
  }
}
