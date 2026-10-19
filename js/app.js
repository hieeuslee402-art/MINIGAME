/**
 * app.js — điểm khởi động, nối dữ liệu ↔ giao diện ↔ cử chỉ.
 *
 * Luồng hoạt động:
 *  1. Vào trang → hiện Slide 1 (giới thiệu) + cổng xin quyền camera.
 *  2. Người dùng bấm "BẮT ĐẦU & BẬT CAMERA" → toàn màn hình + mở camera.
 *  3. Theo dõi CẢ 2 bàn tay qua MediaPipe (mỗi tay tự nhận cử chỉ):
 *       ngón cái + trỏ / giữa / áp út / út → A / B / C / D
 *       giơ cả 2 tay                       → slide tiếp theo
 *       búng tay                           → video kết thúc toàn màn hình
 *  4. Hết 7 câu → slide 9 (slide cuối): video kết thúc tự phát toàn màn hình.
 */
import { CONFIG } from './config.js';
import { slides, questions, deckMeta } from './data/slides.js';
import { HandTracker } from './core/handTracking.js';
import { GestureEngine } from './core/gestures.js';
import { Game } from './core/game.js';
import { Deck } from './ui/deck.js';
import { ICONS, renderIntro, renderQuestion, renderVideoSlide } from './ui/slideRenderer.js';
import { Hud } from './ui/hud.js';
import { Effects } from './ui/effects.js';
import { HandOverlay } from './ui/handOverlay.js';
import { HelpModal } from './ui/help.js';
import { Diagnostics } from './ui/diagnostics.js';
import { applySensitivity } from './core/sensitivity.js';
import { MediaAssets } from './core/mediaAssets.js';
import { SnapDetector } from './core/snapDetector.js';
import { EndVideo } from './ui/endVideo.js';
import { audio } from './utils/audio.js';
import { $ } from './utils/dom.js';

/* ------------------------------------------------------------------ DOM */

const dom = {
  deck: $('#deck'),
  gate: $('#gate'),
  gateCard: $('#gate-card'),
  gateError: $('#gate-error'),
  gateErrorTitle: $('#gate-error-title'),
  gateErrorText: $('#gate-error-text'),
  startBtn: $('#btn-start'),
  skipBtn: $('#btn-skip'),
  video: $('#video'),
  videoMini: $('#video-mini'),
  selfview: $('#selfview'),
  btnPrev: $('#btn-prev'),
  btnNext: $('#btn-next'),
  btnHelp: $('#btn-help'),
  btnDiag: $('#btn-diag'),
  gateBanner: $('#gate-banner'),
  btnSound: $('#btn-sound'),
  btnCamera: $('#btn-camera'),
  btnFullscreen: $('#btn-fullscreen'),
  btnEnd: $('#btn-end'),
  endVideo: $('#end-video'),
  endVideoEl: $('#end-video-el'),
  btnEndClose: $('#btn-end-close'),
};

/* --------------------------------------------------------------- module */

const game = new Game();
const fx = new Effects({
  bgCanvas: $('#bg-particles'),
  fxCanvas: $('#fx-canvas'),
  flashEl: $('#stage-flash'),
  toastLayer: $('#toast-layer'),
});
const hud = new Hud({ totalSlides: slides.length });
const tracker = new HandTracker();
const overlay = new HandOverlay(tracker, $('#hand-canvas'));
const diagnostics = new Diagnostics({ tracker, isCameraOn: () => cameraOn });

const help = new HelpModal({
  onSensitivityChange: (name) => {
    const preset = applySensitivity(name);
    fx.toast(`Độ nhạy cử chỉ: <b>${preset.label}</b>`, { icon: 'hand' });
    try {
      localStorage.setItem('phuduong.sensitivity', name);
    } catch (e) {}
  },
  onOpen: () => {
    gestures.reset();
    prepareMedia().catch(() => {});
  },
  onClose: () => {},
  onOpenDiagnostics: () => diagnostics.show(),
});

const deck = new Deck(
  dom.deck,
  slides.map((slide) => ({
    id: slide.id,
    type: slide.type,
    label:
      slide.type === 'intro'
        ? 'Slide giới thiệu'
        : slide.type === 'video'
        ? 'Slide video kết thúc'
        : `Câu ${slide.question.id}`,
    render: () =>
      slide.type === 'intro'
        ? renderIntro()
        : slide.type === 'question'
        ? renderQuestion(slide.question)
        : renderVideoSlide(),
  }))
);

/* ------------------------------------------------ âm thanh & video kết thúc */

const media = new MediaAssets({
  sources: { dung: CONFIG.media.correct, sai: CONFIG.media.wrong, video: CONFIG.media.video },
  volume: CONFIG.media.volume,
});

const endVideo = new EndVideo({
  root: dom.endVideo,
  video: dom.endVideoEl,
  closeBtn: dom.btnEndClose,
  media,
  onOpen: () => {
    gestures.reset();
    document.body.classList.remove('is-idle'); // hiện con trỏ khi đang chiếu video
  },
  onClose: () => {},
  onMissing: (message) => {
    fx.toast(message || 'Chưa có file <b>end/outro.mp4</b>', { icon: 'video', type: 'warn', duration: 4200 });
    // Không có video → vẫn đưa người xem tới slide video (slide cuối).
    if (deck.type !== 'video') deck.goto(deck.nodes.length - 1, 1);
  },
});

const snap = new SnapDetector({
  config: (({ enabled, ...rest }) => rest)(CONFIG.snap || {}),
  onSnap: () => {
    if (!gateClosed || help.isOpen) return;
    if (endVideo.isOpen) endVideo.replay(); // đang chiếu → búng tay để xem lại từ đầu
    else endVideo.open();
  },
  onError: (err) => {
    console.warn('[app] mic búng tay:', err?.message || err);
  },
});

const gestures = new GestureEngine({
  onNext: () => navigate(1),
  onOption: (key, meta) => handleOption(key, 'gesture', meta),
  onPinchVisual: (state) => {
    hud.setPinch(state);
    overlay.setPinchState(state);
    if (state?.fired) overlay.pulse(state.fired);
  },
});

/* ------------------------------------------------------------- trạng thái */

let cameraOn = false;
let cameraStarting = false;
let gateClosed = false;
let lastHandState = null;
let lastFoundAt = 0;
let endCelebrated = false;
let wakeLock = null;
let noHandTimer = null;
let lastNoHandToast = 0;

/* --------------------------------------------------------------- tiện ích */

function currentQuestionIndex() {
  return deck.type === 'question' ? deck.index - 1 : -1;
}

function questionNode(qIndex) {
  return deck.nodes[qIndex + 1];
}

function setFootMessage(node, text, tone = '') {
  const msg = node.querySelector('[data-msg]');
  if (!msg) return;
  msg.textContent = text;
  msg.classList.toggle('is-good', tone === 'good');
  msg.classList.toggle('is-bad', tone === 'bad');
}

/* ---------------------------------------------------- đồng bộ trạng thái UI */

function syncQuestion(qIndex) {
  const node = questionNode(qIndex);
  if (!node) return;
  const q = questions[qIndex];
  const state = game.answers[qIndex];
  const revealed = game.isRevealed(qIndex);

  const wrongTries = game.wrongTries(qIndex);

  node.querySelectorAll('.q-option').forEach((btn) => {
    const key = btn.dataset.option;
    btn.classList.remove('is-correct', 'is-wrong', 'is-dim', 'is-disabled', 'is-gesture-hint');
    btn.disabled = false;

    if (state) {
      // Đã chọn ĐÚNG → khoá cả câu, tô xanh ô đúng, các ô khác mờ.
      btn.classList.add('is-disabled');
      btn.disabled = true;
      if (key === state.choice) btn.classList.add('is-correct');
      else btn.classList.add('is-dim');
      if (revealed && key === q.answer) btn.classList.add('is-correct');
    } else {
      // Chưa đúng: chỉ khoá những ô đã chọn sai (tô đỏ), còn lại vẫn chọn được.
      if (wrongTries.includes(key)) {
        btn.classList.add('is-wrong', 'is-disabled');
        btn.disabled = true;
      } else if (revealed && key === q.answer) {
        btn.classList.add('is-correct');
      }
    }
  });

  const answerRow = node.querySelector('[data-answer]');
  const value = node.querySelector('[data-answer-value]');
  const peek = node.querySelector('.q-answer__peek');
  if (revealed) {
    answerRow?.classList.add('is-revealed');
    if (value) value.textContent = q.answer;
    if (peek) peek.hidden = true;
  } else {
    answerRow?.classList.remove('is-revealed');
    if (value) value.innerHTML = '<span class="dots">• • •</span>';
    if (peek) peek.hidden = false;
  }

  const card = node.querySelector('.question');
  card?.classList.toggle('is-waiting', !state);

  const nextBtn = node.querySelector('[data-action="next"]');
  if (nextBtn) {
    nextBtn.innerHTML =
      q.id === questions.length ? 'Xem kết quả' : `Câu tiếp theo ${ICONS.arrowRight}`;
  }

  if (state) {
    setFootMessage(node, `Chính xác! +${CONFIG.scoring.correct} điểm — giơ cả 2 tay để tiếp tục.`, 'good');
  } else if (wrongTries.length) {
    setFootMessage(node, `Chưa đúng ${wrongTries.join(', ')} — chọn lại một đáp án khác.`, 'bad');
  } else if (revealed) {
    setFootMessage(node, `Đáp án đúng là ${q.answer}.`, '');
  } else {
    setFootMessage(node, 'Chọn đáp án bằng cử chỉ hoặc phím A / B / C / D', '');
  }
}

function syncAllQuestions() {
  questions.forEach((_, i) => syncQuestion(i));
}

/* ------------------------------------------------------------ điều hướng */

function goNext() {
  if (deck.index === deck.nodes.length - 1) {
    fx.toast('Đây là slide cuối cùng — bấm ← để quay lại', { icon: 'flag', type: 'warn' });
    return false;
  }
  audio.next();
  return deck.next();
}

function goPrev() {
  if (deck.index === 0) return false;
  audio.prev();
  return deck.prev();
}

/** Điều hướng slide (dùng cho phím ← →, nút mũi tên và cử chỉ trỏ + giữa). */
function navigate(direction) {
  if (help.isOpen) return;
  if (direction > 0) {
    goNext();
  } else if (!goPrev()) {
    fx.toast('Đang ở slide đầu tiên', { icon: 'flask' });
  }
}

let videoSlideTimer = null;

deck.onChange = (index, prevIndex, direction) => {
  const node = deck.nodes[index];
  const type = node?.dataset.type || '';
  hud.setSlide(index, deck.nodes.length, type);

  // Slide 9 (video): tới đây là tự phát video kết thúc toàn màn hình
  clearTimeout(videoSlideTimer);
  if (type === 'video') {
    const note = node?.querySelector('[data-video-note]');
    if (note) note.hidden = true;
    videoSlideTimer = setTimeout(async () => {
      if (deck.type !== 'video') return;
      const ok = await endVideo.open();
      const noteEl = deck.nodes[deck.index]?.querySelector('[data-video-note]');
      if (noteEl) noteEl.hidden = ok;
    }, 520);
  } else if (endVideo.isOpen) {
    endVideo.close();
  }

  dom.btnPrev.disabled = index === 0;
  dom.btnNext.disabled = index === deck.nodes.length - 1;

  if (type === 'question') syncQuestion(index - 1);
  if (type === 'video') {
    // tới slide cuối: chúc mừng nếu đã trả lời được câu nào
    if (!endCelebrated && game.stats.answered > 0) {
      endCelebrated = true;
      setTimeout(() => {
        fx.burst('good');
        fx.flash('good');
        audio.finish();
      }, 260);
    }
  } else {
    endCelebrated = false;
  }
};

/* -------------------------------------------------------------- trả lời */

function handleOption(key, source = 'mouse', meta = {}) {
  const qIndex = currentQuestionIndex();
  if (qIndex < 0) {
    if (source === 'gesture') fx.toast('Slide này không có đáp án — giơ cả 2 tay để chuyển slide', { icon: 'hand' });
    return;
  }
  const node = questionNode(qIndex);
  const state = game.answers[qIndex];

  if (state) {
    if (source === 'gesture') {
      fx.toast(`Câu ${qIndex + 1} đã trả lời đúng rồi — giơ cả 2 tay để tiếp tục`, {
        icon: 'arrow',
        type: 'warn',
      });
    }
    return;
  }

  if (game.wrongTries(qIndex).includes(key)) {
    if (source === 'gesture') fx.toast(`Ô ${key} đã chọn rồi — chọn ô khác nhé.`, { icon: 'bad', type: 'warn' });
    return;
  }

  const result = game.answer(qIndex, key);
  hud.flashChip(key);
  syncQuestion(qIndex);
  hud.setScore(game.stats.score);

  if (result.correct) {
    if (!playMedia('dung')) audio.correct();
    fx.flash('good');
    fx.burst('good');
    fx.toast(
      `Chính xác! Đáp án <b>${key}</b> · +${CONFIG.scoring.correct} điểm${
        meta.chord ? ` · ${meta.chord}` : ''
      }`,
      { icon: 'ok' }
    );
  } else {
    if (!playMedia('sai')) audio.wrong();
    fx.flash('bad');
    fx.burst('bad');
    fx.toast(
      `Chưa đúng! Ô <b>${key}</b> chuyển đỏ — chọn lại đáp án khác nhé.`,
      { icon: 'bad', type: 'warn' }
    );
  }
}

function revealCurrent() {
  const qIndex = currentQuestionIndex();
  if (qIndex < 0) {
    fx.toast('Slide này không có đáp án để hiện', { icon: 'flask' });
    return;
  }
  const key = game.reveal(qIndex);
  syncQuestion(qIndex);
  audio.click();
  fx.toast(`Đáp án đúng: <b>${key}</b>`, { icon: 'search' });
}

/* -------------------------------------------------------- camera & cổng */

function showGateError(title, text, kind = 'error') {
  if (!dom.gateError) return;
  dom.gateError.hidden = false;
  dom.gateError.classList.toggle('gate__error--warn', kind === 'warn');
  dom.gateErrorTitle.textContent = title;
  dom.gateErrorText.textContent = text;
}

function hideGateError() {
  if (dom.gateError) dom.gateError.hidden = true;
}

function setGateLoading(loading) {
  if (!dom.startBtn) return;
  dom.startBtn.classList.toggle('is-loading', loading);
  dom.startBtn.disabled = loading;
  dom.startBtn.innerHTML = loading
    ? '<span class="btn__dot"></span> ĐANG KẾT NỐI CAMERA…'
    : '<span class="btn__dot"></span> BẮT ĐẦU &amp; BẬT CAMERA';
}

function explainCameraError(err) {
  const name = err?.name || '';
  if (window.self !== window.top && (name === 'NotAllowedError' || name === 'SecurityError' || err?.code === 'unsupported')) {
    return {
      title: 'Khung xem trước chặn camera',
      text:
        'Trang đang được xem trong iframe (khung xem trước) nên trình duyệt không cho mở camera.\n' +
        'Hãy mở web trong tab riêng: chạy "npm start" → http://localhost:3000, hoặc bản GitHub Pages.',
    };
  }
  if (err?.code === 'model') {
    return {
      title: 'Không nạp được mô hình nhận diện bàn tay',
      text: 'Bộ thư viện MediaPipe trong assets/vendor chưa tải được. Hãy kiểm tra kết nối tới máy chủ chứa web, hoặc dùng chuột / bàn phím để chơi.',
    };
  }
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return {
      title: 'Quyền camera đang bị chặn',
      text:
        'Hãy bấm biểu tượng 🔒 / 📷 trên thanh địa chỉ → chọn "Cho phép" cho camera, rồi bấm lại nút BẮT ĐẦU.\n' +
        'Lưu ý: trang phải chạy trên HTTPS (như GitHub Pages) hoặc localhost — mở trực tiếp bằng file:// sẽ không dùng được camera.',
    };
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      title: 'Không tìm thấy camera',
      text: 'Máy chưa có webcam hoặc camera đang bị ngắt. Bạn vẫn có thể chơi bằng chuột / bàn phím.',
    };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      title: 'Camera đang bận',
      text: 'Một ứng dụng khác (Zoom, Meet, OBS…) đang dùng camera. Hãy đóng ứng dụng đó rồi thử lại.',
    };
  }
  if (err?.code === 'unsupported' || !navigator.mediaDevices) {
    return {
      title: 'Trình duyệt không cho dùng camera ở đây',
      text:
        'Trang có thể đang được xem trong khung xem trước hoặc trình duyệt quá cũ. Hãy mở trực tiếp địa chỉ web (HTTPS) bằng Chrome / Edge / Cốc Cốc / Safari. Trong lúc chờ, bạn có thể chơi bằng chuột hoặc bàn phím.',
    };
  }
  return {
    title: 'Không mở được camera',
    text: `${err?.message || 'Lỗi không xác định.'}\nBạn có thể thử lại, hoặc chơi bằng chuột / bàn phím.`,
  };
}

async function requestFullscreen() {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch (err) {
    /* một số trình duyệt (iOS Safari) không hỗ trợ — bỏ qua */
  }
}

function startHandWatchdog() {
  // Việc tự nâng cấp mô hình / tự phục hồi nay nằm trong core/handTracking.js
  clearInterval(noHandTimer);
}

async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (err) {
    /* không bắt buộc */
  }
}

function closeGate() {
  gateClosed = true;
  dom.gate.classList.add('is-closing');
  document.body.classList.add('is-live');
  setTimeout(() => {
    dom.gate.hidden = true;
  }, 620);
}

async function startExperience() {
  if (cameraStarting) return;
  if (cameraOn && tracker.ready) {
    closeGate();
    return;
  }
  cameraStarting = true;
  hideGateError();
  setGateLoading(true);
  requestFullscreen();
  fx.toast('Đang mở camera — hãy bấm <b>Cho phép</b> nếu trình duyệt hỏi', {
    icon: 'cam',
    duration: 3600,
  });

  try {
    await tracker.startCamera();
    if (dom.videoMini) {
      dom.videoMini.srcObject = tracker.stream;
      await dom.videoMini.play().catch(() => {});
    }
    cameraOn = true;
    document.body.classList.remove('no-cam-bg');
    document.body.classList.add('cam-on');
    hud.showSelfview(true);
    overlay.start();

    await tracker.loadModel();
    tracker.start();
    startHandWatchdog();
    acquireWakeLock();
    audio.ensure();

    closeGate();
    fx.toast('Camera đã sẵn sàng — chạm ngón để chọn đáp án, giơ cả 2 tay để chuyển câu', { icon: 'hand', duration: 4600 });

    // Chuẩn bị âm thanh đúng/sai + video kết thúc (nếu có file trong repo)
    await prepareMedia();
    if (snapEnabled()) enableSnap(true);
  } catch (err) {
    console.warn('[app] Không khởi động được camera:', err);
    const info = explainCameraError(err);
    showGateError(info.title, info.text);
    audio.error();
    if (!cameraOn) {
      overlay.stop();
      hud.showSelfview(false);
    } else {
      // Camera đã chạy nhưng mô hình nhận diện lỗi: vẫn vào được, dùng chuột/bàn phím.
      showGateError(
        `${info.title} (camera vẫn hoạt động)`,
        `${info.text}\nBạn có thể bấm "Chơi bằng chuột / bàn phím" để tiếp tục, hoặc "Chẩn đoán camera" để xem chi tiết.`
      );
      diagnostics.show();
    }
  } finally {
    cameraStarting = false;
    setGateLoading(false);
  }
}

function skipCamera() {
  closeGate();
  document.body.classList.add('no-cam-bg');
  document.body.classList.remove('cam-on');
  hud.showSelfview(false);
  fx.toast('Chế độ chuột / bàn phím — dùng ← → để chuyển slide, A B C D để chọn đáp án', {
    icon: 'mouse',
    duration: 5200,
  });
}

/* --------------------------------------------------------------- sự kiện */


/* ------------------------------------------------- âm thanh & video kết thúc */

function snapEnabled() {
  if (CONFIG.snap?.enabled === false) return false;
  try {
    return localStorage.getItem('phuduong.snap') !== '0';
  } catch (e) {
    return true;
  }
}

/** Phát file người dùng đặt; tắt tiếng thì coi như "đã xử lý" để không phát âm tổng hợp. */
function playMedia(kind) {
  if (!audio.enabled) return true;
  return media.play(kind);
}

async function prepareMedia() {
  await media.resolve();
  const status = media.status;
  const missing = [];
  if (!status.dung) missing.push('<code>dung/dung.mp3</code>');
  if (!status.sai) missing.push('<code>sai/sai.mp3</code>');
  if (!status.video) missing.push('<code>end/outro.mp4</code>');

  const statusEl = document.getElementById('media-status');
  if (statusEl) {
    statusEl.innerHTML = missing.length
      ? `Thiếu ${missing.join(', ')} — web sẽ dùng âm tổng hợp, búng tay vẫn chạy nếu đã có video.`
      : 'Đã tìm thấy <code>dung/dung.mp3</code>, <code>sai/sai.mp3</code>, <code>end/outro.mp4</code>.';
  }
  if (endVideo.video && media.videoUrl && endVideo.video.getAttribute('src') !== media.videoUrl) {
    endVideo.video.setAttribute('src', media.videoUrl);
  }
  endVideo.available = Boolean(media.videoUrl);
  return status;
}

async function enableSnap(on) {
  if (!on) {
    snap.stop();
    syncSnapUi(false);
    return false;
  }
  const ok = await snap.start();
  syncSnapUi(ok);
  if (!ok) {
    // Không mở được micro: chỉ đổi giao diện, KHÔNG ghi đè lựa chọn của người dùng
    document.querySelectorAll('#snap-select [data-snap]').forEach((btn) => {
      btn.classList.toggle('is-on', btn.dataset.snap === 'off');
    });
  }
  return ok;
}

function syncSnapUi(on) {
  document.querySelectorAll('#snap-select [data-snap]').forEach((btn) => {
    btn.classList.toggle('is-on', (btn.dataset.snap === 'on') === on);
  });
  const el = document.getElementById('snap-status');
  if (!el) return;
  if (on) {
    el.innerHTML = snap.supported
      ? 'Micro <b>đang bật</b> — búng tay (hoặc bấm phím <kbd>E</kbd>) để chiếu video kết thúc.'
      : 'Thiết bị không hỗ trợ phân tích micro — dùng phím <kbd>E</kbd> để chiếu video.';
  } else {
    el.innerHTML = 'Micro <b>đang tắt</b> — bật để búng tay chiếu video, hoặc bấm phím <kbd>E</kbd>.';
  }
}

function toggleSound() {
  const enabled = audio.toggle();
  document.body.classList.toggle('is-muted', !enabled);
  try {
    localStorage.setItem('phuduong.sound', enabled ? '1' : '0');
  } catch (e) {}
  if (enabled) audio.click();
  fx.toast(enabled ? 'Đã bật âm thanh' : 'Đã tắt âm thanh', { icon: enabled ? 'sound' : 'mute', duration: 1600 });
}

function toggleCameraBg() {
  if (!cameraOn) {
    fx.toast('Camera chưa bật — hãy tải lại trang và bật camera', { icon: 'cam', type: 'warn' });
    return;
  }
  const hidden = document.body.classList.toggle('no-cam-bg');
  fx.toast(hidden ? 'Đã ẩn nền camera' : 'Đã hiện nền camera', { icon: 'cam', duration: 1600 });
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else requestFullscreen();
}

/* -------------------------------------------------------------- khởi động */

function init() {
  deck.mount();
  fx.init();
  syncAllQuestions();
  deck.goto(0, 1);
  prepareMedia().catch(() => {});
  syncSnapUi(false);
  hud.setScore(0);

  try {
    if (localStorage.getItem('phuduong.sound') === '0') {
      audio.enabled = false;
      document.body.classList.add('is-muted');
    }
    const savedSens = localStorage.getItem('phuduong.sensitivity');
    if (savedSens) {
      applySensitivity(savedSens);
      help.syncSensitivity(savedSens);
    }
    const savedEnhance = localStorage.getItem('phuduong.enhance');
    if (savedEnhance !== null) {
      CONFIG.hand.enhance.enabled = savedEnhance !== '0';
      help.syncEnhance(CONFIG.hand.enhance.enabled);
    }
  } catch (e) {}

  // ---- nút bấm
  dom.startBtn?.addEventListener('click', startExperience);
  dom.skipBtn?.addEventListener('click', skipCamera);
  dom.btnPrev?.addEventListener('click', () => goPrev());
  dom.btnNext?.addEventListener('click', () => goNext());
  dom.btnHelp?.addEventListener('click', () => help.toggle());
  dom.btnDiag?.addEventListener('click', () => diagnostics.toggle());
  dom.btnSound?.addEventListener('click', toggleSound);
  dom.btnCamera?.addEventListener('click', toggleCameraBg);
  dom.btnFullscreen?.addEventListener('click', toggleFullscreen);
  dom.btnEnd?.addEventListener('click', () => endVideo.toggle());
  dom.btnEndClose?.addEventListener('click', () => endVideo.close());

  // ---- bật/tắt micro nhận búng tay
  document.querySelectorAll('#snap-select [data-snap]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const on = btn.dataset.snap === 'on';
      try {
        localStorage.setItem('phuduong.snap', on ? '1' : '0');
      } catch (e) {}
      if (on) {
        const ok = await enableSnap(true);
        fx.toast(
          ok ? 'Đã bật micro — <b>búng tay</b> để chiếu video kết thúc' : 'Không mở được micro (cần HTTPS + quyền truy cập)',
          { icon: 'sound', type: ok ? '' : 'warn', duration: 3200 }
        );
      } else {
        await enableSnap(false);
        fx.toast('Đã tắt micro — dùng phím <b>E</b> để chiếu video', { icon: 'mute', duration: 2600 });
      }
    });
  });
  $('#btn-test-dung')?.addEventListener('click', () => {
    if (!playMedia('dung')) audio.correct();
    fx.toast(media.urls.dung ? `Đang phát <b>${media.urls.dung}</b>` : 'Chưa có file <b>dung/dung.mp3</b> — dùng âm tổng hợp', { icon: 'sound' });
  });
  $('#btn-test-sai')?.addEventListener('click', () => {
    if (!playMedia('sai')) audio.wrong();
    fx.toast(media.urls.sai ? `Đang phát <b>${media.urls.sai}</b>` : 'Chưa có file <b>sai/sai.mp3</b> — dùng âm tổng hợp', { icon: 'sound' });
  });

  // ---- thao tác trong slide
  dom.deck.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (action) {
      const kind = action.dataset.action;
      if (kind === 'start') {
        if (cameraOn || gateClosed) goNext();
        else startExperience();
      } else if (kind === 'next') {
        goNext();
      } else if (kind === 'reveal') {
        revealCurrent();
      } else if (kind === 'play-video') {
        endVideo.open().then((ok) => {
          const noteEl = deck.nodes[deck.index]?.querySelector('[data-video-note]');
          if (noteEl && deck.type === 'video') noteEl.hidden = ok;
        });
      }
      return;
    }

    const option = event.target.closest('.q-option');
    if (option) handleOption(option.dataset.option, 'mouse');
  });

  // ---- phím tắt
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;
    const key = event.key;

    // Video kết thúc đang mở: chỉ Esc / E / Enter để đóng
    if (endVideo.isOpen) {
      if (key === 'Escape' || key === 'e' || key === 'E' || key === 'Enter') {
        event.preventDefault();
        endVideo.close();
      }
      return;
    }

    if (!gateClosed) {
      if (key === 'Enter') {
        event.preventDefault();
        startExperience();
      } else if (key === 'h' || key === 'H') {
        event.preventDefault();
        help.toggle();
      }
      return;
    }

    if (key === 'h' || key === 'H' || key === '?') {
      event.preventDefault();
      help.toggle();
      return;
    }
    if (help.isOpen) return;

    if (key === 'ArrowRight' || key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      navigate(1);
    } else if (key === 'ArrowLeft') {
      event.preventDefault();
      navigate(-1);
    } else if (['a', 'A', 'b', 'B', 'c', 'C', 'd', 'D'].includes(key)) {
      event.preventDefault();
      handleOption(key.toUpperCase(), 'mouse');
    } else if (key === 'r' || key === 'R') {
      event.preventDefault();
      revealCurrent();
    } else if (key === 'f' || key === 'F') {
      event.preventDefault();
      toggleFullscreen();
    } else if (key === 's' || key === 'S') {
      event.preventDefault();
      toggleSound();
    } else if (key === 'v' || key === 'V') {
      event.preventDefault();
      toggleCameraBg();
    } else if (key === 'e' || key === 'E') {
      event.preventDefault();
      endVideo.open();
    }
  });

  // ---- khung hình bàn tay → cử chỉ
  tracker.on('frame', ({ landmarks, now, hands, handsCount, twoHandsUp }) => {
    const blocked = help.isOpen || endVideo.isOpen || !gateClosed;
    gestures.update(blocked ? null : landmarks, now, { hands, handsCount, twoHandsUp });

    if (!landmarks) {
      if (lastFoundAt && now - lastFoundAt > 600) {
        const state = JSON.stringify({ found: false, label: '' });
        if (state !== lastHandState) {
          lastHandState = state;
          hud.setHandState({ found: false, hint: 'ĐƯA BÀN TAY VÀO KHUNG HÌNH…' });
        }
      }
      return;
    }

    lastFoundAt = now;
    const label = tracker.detectedLabel === 'Right' ? 'TAY PHẢI' : 'TAY TRÁI';
    const state = JSON.stringify({ found: true, label });
    if (state !== lastHandState) {
      lastHandState = state;
      hud.setHandState({ found: true, label });
    }
  });

  tracker.on('modelStatus', ({ text }) => {
    if (text) fx.toast(text, { icon: 'brain', duration: 2200 });
  });

  // --- số liệu sống trong khung camera nhỏ
  tracker.on('health', (stats) => {
    hud.setHealth(stats);
    const noHandFor = stats.framesSent > 10 && !tracker.lastSeenAt;
    if (noHandFor && performance.now() - (lastNoHandToast || 0) > 12000 && gateClosed) {
      lastNoHandToast = performance.now();
      fx.toast(
        'Chưa thấy bàn tay — lùi tay ra <b>40–70 cm</b>, để cả cổ tay trong khung và bật đèn phía trước.',
        { icon: 'hand', type: 'warn', duration: 5200 }
      );
    }
  });

  // --- tự phục hồi mô hình
  tracker.on('recovering', ({ reason }) => {
    fx.toast('Đang tự khởi động lại mô hình nhận diện…', { icon: 'brain', duration: 2400 });
    console.info('[tracker] tự phục hồi:', reason);
  });

  tracker.on('needGuidance', () => {
    fx.toast(
      'Đã hạ ngưỡng nhận diện. Nếu vẫn không thấy tay: lùi ra xa, tăng ánh sáng, hoặc bấm <b>chẩn đoán</b> → <b>THỬ NHẬN DIỆN TAY NGAY</b>.',
      { icon: 'warn', type: 'warn', duration: 7000 }
    );
  });

  // ---- phát hiện đang nằm trong iframe (khung xem trước) → camera bị chặn
  const inIframe = window.self !== window.top;
  if (inIframe && dom.gateBanner) dom.gateBanner.hidden = false;

  // ---- cảnh báo môi trường không hỗ trợ camera
  const isFile = location.protocol === 'file:';
  if (isFile || !window.isSecureContext) {
    showGateError(
      'Lưu ý: môi trường hiện tại có thể chặn camera',
      isFile
        ? 'Bạn đang mở web bằng file://. Camera chỉ hoạt động trên HTTPS hoặc localhost — hãy chạy "npm start" hoặc đưa web lên GitHub Pages. Bạn vẫn có thể chơi bằng chuột / bàn phím.'
        : 'Trang cần HTTPS để dùng camera. Bạn vẫn có thể chơi bằng chuột / bàn phím.',
      'warn'
    );
  }

  // ---- tự ẩn con trỏ khi thuyết trình
  let idleTimer = null;
  const wake = () => {
    document.body.classList.remove('is-idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (gateClosed) document.body.classList.add('is-idle');
    }, 4200);
  };
  ['mousemove', 'mousedown', 'touchstart', 'keydown'].forEach((evt) =>
    window.addEventListener(evt, wake, { passive: true })
  );
  wake();

  // ---- tạm dừng mô hình khi chuyển tab
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      tracker.stop();
      gestures.reset();
    } else if (cameraOn) {
      tracker.start();
      acquireWakeLock();
    }
  });

  // ---- API gỡ lỗi (chỉ bật khi thêm ?debug=1 vào địa chỉ)
  if (new URLSearchParams(location.search).has('debug')) {
    window.__PD = { tracker, gestures, game, deck, hud, overlay, diagnostics, help, media, snap, endVideo, CONFIG };
    console.info('[debug] window.__PD đã sẵn sàng');
  }

  // ---- cập nhật tiêu đề & log gọn
  document.title = `${deckMeta.title} — ${deckMeta.subtitle}`;
  console.info(
    '%c⚗️ TỔ 1 · MINI GAME PHÚ DƯỠNG',
    'background:#5ef2c0;color:#04231a;padding:4px 8px;border-radius:4px;font-weight:700'
  );
  console.info('Cử chỉ: cái+trỏ = A · cái+giữa = B · cái+áp út = C · cái+út = D (tay nào cũng được) · giơ 2 tay = câu tiếp · búng tay = video kết thúc');

  // Đánh dấu app đã khởi động (dùng cho banner cảnh báo file://).
  window.__APP_BOOTED__ = true;
  const bootBox = document.getElementById('bootfail');
  if (bootBox) bootBox.hidden = true;
}

init();
