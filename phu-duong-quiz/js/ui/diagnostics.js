/**
 * ui/diagnostics.js
 * Bảng chẩn đoán camera / mô hình: chỉ rõ vì sao camera không chạy và cách khắc phục.
 * Mở bằng nút ống nghe trên thanh công cụ hoặc liên kết trong cổng bắt đầu.
 */
import { el } from '../utils/dom.js';
import { CONFIG } from '../config.js';

const ICON = {
  ok: '<svg viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bad: '<svg viewBox="0 0 24 24" fill="none"><path d="m6.5 6.5 11 11M17.5 6.5l-11 11" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4.5 21 19.5H3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>',
};

const row = (label, value, state = '') =>
  `<div class="diag-row${state ? ` is-${state}` : ''}"><span>${label}</span><b>${
    state === 'ok' ? ICON.ok : state === 'bad' ? ICON.bad : state === 'warn' ? ICON.warn : ''
  }${value}</b></div>`;

export class Diagnostics {
  constructor({ tracker, isCameraOn }) {
    this.tracker = tracker;
    this.isCameraOn = isCameraOn || (() => false);
    this.modal = null;
    this.timer = null;
    this.open = false;
    this._lastTest = null;
  }

  mount() {
    if (this.modal) return;
    this.modal = el('div', {
      class: 'modal diag',
      id: 'diag-modal',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'diag-title',
      hidden: 'hidden',
    });
    this.modal.innerHTML = `
      <div class="modal__backdrop" data-close="diag"></div>
      <div class="modal__card diag__card">
        <header class="modal__head">
          <div>
            <p class="modal__eyebrow">CHẨN ĐOÁN</p>
            <h2 id="diag-title">Camera &amp; nhận diện bàn tay</h2>
          </div>
          <button class="icon-btn" type="button" data-close="diag" aria-label="Đóng">
            <svg viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </header>
        <div class="modal__body">
          <div class="diag__grid" id="diag-body"></div>
          <div class="diag__advice" id="diag-advice"></div>
          <div class="diag__actions">
            <button class="btn btn--primary" type="button" id="diag-test">KIỂM TRA CAMERA</button>
            <button class="btn btn--primary" type="button" id="diag-probe">THỬ NHẬN DIỆN TAY NGAY</button>
            <button class="btn btn--ghost" type="button" id="diag-copy">SAO CHÉP KẾT QUẢ</button>
          </div>
          <div class="diag__probe" id="diag-probe-result" hidden></div>
          <p class="diag__foot">Mẹo: gửi nội dung "Sao chép kết quả" cho người phụ trách để được hỗ trợ nhanh.</p>
        </div>
      </div>
    `;
    document.body.append(this.modal);

    this.modal.querySelectorAll('[data-close="diag"]').forEach((node) =>
      node.addEventListener('click', () => this.close())
    );
    this.modal.querySelector('#diag-test')?.addEventListener('click', () => this.testCamera());
    this.modal.querySelector('#diag-probe')?.addEventListener('click', () => this.probeHand());
    this.modal.querySelector('#diag-copy')?.addEventListener('click', () => this.copy());

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.open) {
        event.preventDefault();
        this.close();
      }
    });
  }

  /* --------------------------------------------------------------- render */

  _environment() {
    const inIframe = window.self !== window.top;
    return {
      inIframe,
      protocol: location.protocol,
      secure: window.isSecureContext,
      hasMedia: Boolean(navigator.mediaDevices?.getUserMedia),
    };
  }

  async _permissionState() {
    try {
      if (!navigator.permissions?.query) return 'không hỗ trợ';
      const status = await navigator.permissions.query({ name: 'camera' });
      return status.state;
    } catch (err) {
      return 'không truy vấn được';
    }
  }

  async _devices() {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return [];
      const list = await navigator.mediaDevices.enumerateDevices();
      return list.filter((d) => d.kind === 'videoinput');
    } catch (err) {
      return [];
    }
  }

  async render() {
    if (!this.modal) return;
    const body = this.modal.querySelector('#diag-body');
    const advice = this.modal.querySelector('#diag-advice');
    if (!body) return;

    const env = this._environment();
    const perm = await this._permissionState();
    const devices = await this._devices();
    const cam = this.tracker.cameraInfo();
    const stats = this.tracker.stats;
    const lastSeen = this.tracker.lastSeenAt
      ? `${((performance.now() - this.tracker.lastSeenAt) / 1000).toFixed(1)} giây trước`
      : 'chưa thấy';

    const iframeBlocked = env.inIframe;
    body.innerHTML = `
      <section>
        <h3>Môi trường</h3>
        ${row('Địa chỉ', `${env.protocol}//${location.host || '(không có host)'}`, env.protocol === 'https:' || location.hostname === 'localhost' ? 'ok' : 'bad')}
        ${row('Kết nối an toàn (HTTPS/localhost)', env.secure ? 'Có' : 'Không', env.secure ? 'ok' : 'bad')}
        ${row('Đang nằm trong khung nhúng (iframe)', iframeBlocked ? 'Có — thường bị chặn camera' : 'Không', iframeBlocked ? 'bad' : 'ok')}
        ${row('Trình duyệt hỗ trợ camera', env.hasMedia ? 'Có' : 'Không', env.hasMedia ? 'ok' : 'bad')}
      </section>
      <section>
        <h3>Quyền &amp; thiết bị</h3>
        ${row('Quyền camera', perm, perm === 'granted' ? 'ok' : perm === 'denied' ? 'bad' : 'warn')}
        ${row('Số camera phát hiện', String(devices.length), devices.length ? 'ok' : 'warn')}
        ${row('Camera đang mở', cam.active ? `Có (${cam.width}×${cam.height})` : 'Chưa', cam.active ? 'ok' : 'warn')}
        ${row('Luồng video sẵn sàng', cam.readyState >= 2 ? 'Có' : 'Chưa', cam.readyState >= 2 ? 'ok' : 'warn')}
        ${cam.label ? row('Tên thiết bị', cam.label) : ''}
      </section>
      <section>
        <h3>Mô hình nhận diện</h3>
        ${row('Đã nạp mô hình', this.tracker.ready ? 'Có' : 'Chưa', this.tracker.ready ? 'ok' : 'bad')}
        ${row('Nguồn mô hình', this.tracker.modelSource === 'cdn' ? 'CDN dự phòng' : this.tracker.modelSource === 'local' ? 'Trong repo (offline)' : '—')}
        ${row('Tốc độ suy luận', `${stats.fps || 0} khung/giây`, (stats.fps || 0) > 8 ? 'ok' : 'warn')}
        ${row('Khung hình đã xử lý', String(stats.framesSent))}
        ${row('Số khung hình thấy tay', String(stats.framesWithHand), stats.framesWithHand > 0 ? 'ok' : 'warn')}
        ${row('Tay nhận được / bị loại (khung gần nhất)', `${stats.handsCount ?? 0} / ${stats.handsRejected ?? 0}`, (stats.handsRejected || 0) > 0 ? 'warn' : 'ok')}
        ${row('Lần thấy tay gần nhất', lastSeen, this.tracker.lastSeenAt ? 'ok' : 'warn')}
        ${row('Số lần tự phục hồi', String(stats.recoveries || 0), stats.recoveries ? 'warn' : '')}
        ${row('Gửi khung hình bị treo', stats.sendStalled ? 'Có' : 'Không', stats.sendStalled ? 'bad' : 'ok')}
        ${row('Độ nhạy cử chỉ', CONFIG.sensitivity)}
      </section>
    `;

    const problems = [];
    if (iframeBlocked) {
      problems.push(
        'Bạn đang xem web trong <b>khung xem trước/iframe</b> — trình duyệt thường chặn camera ở đây. Hãy mở web trong một tab riêng (localhost hoặc GitHub Pages).'
      );
    }
    if (!env.secure) {
      problems.push(
        'Trang không chạy trên <b>HTTPS/localhost</b> nên camera bị chặn. Hãy chạy <code>npm start</code> rồi mở <code>http://localhost:3000</code>, hoặc đưa lên GitHub Pages.'
      );
    }
    if (perm === 'denied') {
      problems.push(
        'Quyền camera đang bị <b>chặn</b>. Bấm biểu tượng 🔒 trên thanh địa chỉ → Camera → <b>Cho phép</b>, rồi tải lại trang.'
      );
    }
    if (!this.tracker.ready) {
      problems.push('Mô hình nhận diện chưa nạp được. Hãy bấm <b>BẮT ĐẦU &amp; BẬT CAMERA</b> lại, hoặc kiểm tra mạng (bản dự phòng cần Internet).');
    }
    if (this.tracker.ready && stats.framesWithHand === 0 && this.isCameraOn()) {
      problems.push(
        'Camera đã chạy nhưng <b>chưa thấy bàn tay</b>: tăng ánh sáng phía trước, đưa tay cách camera 40–70 cm, xòe bàn tay hướng về camera; thử đổi <b>Độ nhạy</b> sang "Mạnh" trong bảng Trợ giúp (H).'
      );
    }
    if (this._lastTest && !this._lastTest.ok) {
      problems.push(`Lần kiểm tra camera gần nhất lỗi: <code>${this._lastTest.name}</code> — ${this._lastTest.message}`);
    }

    const testOk =
      this._lastTest && this._lastTest.ok
        ? `<p class="diag__ok">✓ ${this._lastTest.message}</p>`
        : '';
    advice.innerHTML =
      (problems.length
        ? `<b>Cần xử lý:</b><ul>${problems.map((p) => `<li>${p}</li>`).join('')}</ul>`
        : '<b>Mọi thứ đều ổn.</b> Nếu cử chỉ vẫn không nhận, hãy tăng độ nhạy trong bảng Trợ giúp (phím H) rồi thử lại.') +
      testOk;

    const testBtn = this.modal.querySelector('#diag-test');
    if (testBtn && this._lastTest) {
      testBtn.textContent = this._lastTest.ok ? 'KIỂM TRA LẠI CAMERA' : 'THỬ LẠI CAMERA';
    }
  }

  /* ---------------------------------------------------------------- test */

  async testCamera() {
    const btn = this.modal?.querySelector('#diag-test');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'ĐANG KIỂM TRA…';
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error('Trình duyệt không có navigator.mediaDevices.getUserMedia'), {
          name: 'NotSupported',
        });
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings?.() || {};
      this._lastTest = {
        ok: true,
        name: 'OK',
        message: `Mở camera thành công (${settings.width || '?'}×${settings.height || '?'}) — ${track?.label || 'camera'}`,
      };
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      this._lastTest = {
        ok: false,
        name: err?.name || 'Error',
        message: err?.message || String(err),
      };
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'KIỂM TRA LẠI CAMERA';
      }
      this.render();
    }
  }

  /* ------------------------------------------------------- thử nhận diện */

  async probeHand() {
    const box = this.modal?.querySelector('#diag-probe-result');
    const btn = this.modal?.querySelector('#diag-probe');
    if (box) {
      box.hidden = false;
      box.innerHTML = '<p class="diag__pending">Đang chụp khung hình hiện tại và cho mô hình nhận diện…</p>';
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'ĐANG THỬ…';
    }

    let result;
    try {
      result = await this.tracker.probe();
    } catch (err) {
      result = { ok: false, error: err.message };
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = 'THỬ NHẬN DIỆN LẠI';
    }

    if (!box) return;

    if (result.ok) {
      box.innerHTML = `
        <b class="is-ok">✓ Nhận diện được ${result.count} bàn tay (${result.handedness.join(', ')})</b>
        <p>Mô hình đang hoạt động tốt với khung hình hiện tại. Nếu cử chỉ vẫn không ăn, hãy thử <b>Độ nhạy: Mạnh</b> (phím H).</p>
        ${result.snapshot ? `<img class="diag__shot" src="${result.snapshot}" alt="Khung hình mô hình nhận được" />` : ''}
      `;
    } else {
      box.innerHTML = `
        <b class="is-bad">✗ Không thấy bàn tay trong khung hình</b>
        <p>${result.error || 'Mô hình không phát hiện bàn tay.'}</p>
        <ul>
          <li>Lùi tay ra <b>40–70 cm</b>, để thấy cả cổ tay trong khung.</li>
          <li>Xòe bàn tay hướng thẳng vào camera, bật thêm đèn phía trước.</li>
          <li>Tránh ngược sáng (cửa sổ/đèn ở sau lưng).</li>
        </ul>
        ${result.snapshot ? `<img class="diag__shot" src="${result.snapshot}" alt="Khung hình mô hình nhận được" />` : ''}
      `;
    }
  }

  /* ---------------------------------------------------------------- copy */

  summary() {
    const env = this._environment();
    const cam = this.tracker.cameraInfo();
    const s = this.tracker.stats;
    return [
      '=== CHẨN ĐOÁN MINI GAME PHÚ DƯỠNG ===',
      `Thời điểm: ${new Date().toLocaleString('vi-VN')}`,
      `URL: ${location.href}`,
      `Giao thức: ${env.protocol} | secureContext: ${env.secure} | trong iframe: ${env.inIframe}`,
      `getUserMedia: ${env.hasMedia ? 'có' : 'KHÔNG'}`,
      `Camera: active=${cam.active} | ${cam.width}x${cam.height} | readyState=${cam.readyState} | ${cam.label}`,
      `Mô hình: ready=${this.tracker.ready} | nguồn=${this.tracker.modelSource || '-'} | fps=${s.fps} | khung=${s.framesSent} | có tay=${s.framesWithHand} | tay=${s.handsCount ?? 0} (loại ${s.handsRejected ?? 0}) | 2 tay=${s.twoHandsUp ? 'có' : 'không'}`,
      `Độ nhạy: ${CONFIG.sensitivity}`,
      `Kiểm tra camera gần nhất: ${this._lastTest ? `${this._lastTest.name} — ${this._lastTest.message}` : 'chưa chạy'}`,
      `Lỗi mô hình: ${s.modelError || 'không'}`,
      `Lỗi khác: ${s.errors.length ? s.errors.slice(-5).join(' ; ') : 'không'}`,
      `Trình duyệt: ${navigator.userAgent}`,
    ].join('\n');
  }

  async copy() {
    const text = this.summary();
    try {
      await navigator.clipboard.writeText(text);
      this._flash('Đã sao chép kết quả chẩn đoán vào clipboard.');
    } catch (err) {
      // Trình duyệt chặn clipboard (iframe/http): hiện hộp để tự chọn
      const box = this.modal.querySelector('#diag-advice');
      if (box) {
        box.innerHTML = `<b>Chép nội dung dưới đây:</b><textarea class="diag__textarea" readonly>${text}</textarea>`;
        box.querySelector('textarea')?.select();
      }
    }
  }

  _flash(message) {
    const advice = this.modal?.querySelector('#diag-advice');
    if (!advice) return;
    const note = el('p', { class: 'diag__flash', text: message });
    advice.prepend(note);
    setTimeout(() => note.remove(), 2600);
  }

  /* ---------------------------------------------------------------- open */

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  show() {
    this.mount();
    if (this.open) return;
    this.open = true;
    this.modal.hidden = false;
    document.body.classList.add('is-modal-open');
    this.render();
    this.timer = setInterval(() => this.render(), 800);
  }

  close() {
    if (!this.modal || !this.open) return;
    this.open = false;
    this.modal.hidden = true;
    document.body.classList.remove('is-modal-open');
    clearInterval(this.timer);
  }
}
