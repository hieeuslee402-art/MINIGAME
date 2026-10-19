/**
 * ui/slideRenderer.js
 * Sinh DOM cho 3 loại slide: giới thiệu, câu hỏi, kết thúc.
 * Văn bản hiển thị lấy trực tiếp từ data/slides.js (giữ nguyên nội dung gốc).
 */
import { deckMeta, videoSlide } from '../data/slides.js';
import { el } from '../utils/dom.js';

export const ICONS = {
  check: `<svg viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  cross: `<svg viewBox="0 0 24 24" fill="none"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  arrowRight: `<svg viewBox="0 0 24 24" fill="none"><path d="M4.5 12h14M13 6.5 18.5 12 13 17.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v5.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="7.9" r="1.15" fill="currentColor"/></svg>`,
  award: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="9" r="5.4" stroke="currentColor" stroke-width="1.8"/><path d="m8.6 13.6-1.4 6 4.8-2.6 4.8 2.6-1.4-6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m12 6.6 1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2L8.8 8.9l2.2-.3z" fill="currentColor"/></svg>`,
  hand: `<svg viewBox="0 0 24 24" fill="none"><path d="M8.5 11V5.4a1.4 1.4 0 0 1 2.8 0V10m0 0V4.2a1.4 1.4 0 0 1 2.8 0V10m0 0V5.6a1.4 1.4 0 0 1 2.8 0v7.6c0 3.7-2.4 6.3-5.9 6.3-2 0-3.4-.7-4.5-2.4L5 13.9c-.5-.8-.3-1.8.5-2.3.7-.4 1.6-.2 2 .5l1 1.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

/* --------------------------------------------------------------- SLIDE 1 */

function introArt() {
  return `
  <div class="intro__art" aria-hidden="true">
    <span class="art__glow"></span>
    <span class="art__ring"></span>
    <span class="art__ring art__ring--2"></span>
    <span class="art__ring art__ring--3"></span>

    <div class="art__tile art__tile--n" style="--tile-rot:-7deg">
      <div class="art__num">07</div>
      <div class="art__sym">N</div>
      <div class="art__name">Nitơ</div>
      <div class="art__mass">14,007</div>
    </div>

    <svg class="art__mol" viewBox="0 0 200 200" fill="none">
      <line x1="100" y1="100" x2="100" y2="38"/>
      <line x1="100" y1="100" x2="156" y2="132"/>
      <line x1="100" y1="100" x2="44" y2="132"/>
      <line x1="100" y1="100" x2="100" y2="162"/>
      <line x1="100" y1="38" x2="146" y2="20"/>
      <line x1="156" y1="132" x2="182" y2="112"/>
      <line x1="44" y1="132" x2="18" y2="112"/>
      <line x1="100" y1="162" x2="62" y2="182"/>
      <circle cx="100" cy="100" r="25" class="is-accent"/>
      <circle cx="100" cy="38" r="15"/>
      <circle cx="156" cy="132" r="15"/>
      <circle cx="44" cy="132" r="15"/>
      <circle cx="100" cy="162" r="15"/>
      <circle cx="146" cy="20" r="9"/>
      <circle cx="182" cy="112" r="9"/>
      <circle cx="18" cy="112" r="9"/>
      <circle cx="62" cy="182" r="9"/>
      <text x="100" y="100">N</text>
      <text x="100" y="38">P</text>
      <text x="156" y="132">O</text>
      <text x="44" y="132">O</text>
      <text x="100" y="162">C</text>
      <text x="146" y="20">H</text>
      <text x="182" y="112">H</text>
      <text x="18" y="112">H</text>
      <text x="62" y="182">H</text>
    </svg>

    <div class="art__tile art__tile--p" style="--tile-rot:6deg">
      <div class="art__num">15</div>
      <div class="art__sym">P</div>
      <div class="art__name">Photpho</div>
      <div class="art__mass">30,974</div>
    </div>

  </div>`;
}

export function renderIntro() {
  const node = el('article', { class: 'intro panel' });
  node.innerHTML = `
    <div class="intro__main">
      <div class="intro__top" data-anim style="--d:40ms">
        <span class="intro__dot"></span>
        <span class="tag">MINI GAME • ${deckMeta.org}</span>
        <span class="tag tag--soft">HÓA HỌC / GIÁO DỤC MÔI TRƯỜNG</span>
      </div>

      <h1 class="intro__title" data-anim style="--d:110ms">
        SAU ĐÂY LÀ MINI GAME <span>TRẢ LỜI CÂU HỎI CỦA TỔ 1</span>
      </h1>

      <h2 class="intro__deck-title" data-anim style="--d:210ms">${deckMeta.title}</h2>
      <p class="intro__deck-sub" data-anim style="--d:270ms">${deckMeta.subtitle}</p>

      <div class="intro__actions" data-anim style="--d:450ms">
        <button class="btn btn--primary btn--glow" type="button" data-action="start">
          <span class="btn__dot"></span> BẮT ĐẦU MINI GAME
        </button>
      </div>
    </div>
    ${introArt()}
  `;
  return node;
}

/* --------------------------------------------------------------- CÂU HỎI */

function elementTile(badge) {
  return `
    <div class="q-element" aria-hidden="true">
      <div class="q-element__row"><span>${badge.number}</span><span>${badge.mass}</span></div>
      <div>
        <div class="q-element__sym">${badge.symbol}</div>
        <div class="q-element__name">${badge.name}</div>
      </div>
    </div>`;
}

const OPTION_TITLES = {
  A: 'Chọn A — ngón cái chạm ngón trỏ',
  B: 'Chọn B — ngón cái chạm ngón giữa',
  C: 'Chọn C — ngón cái chạm ngón áp út',
  D: 'Chọn D — ngón cái chạm ngón út',
};

export function renderQuestion(q) {
  const node = el('article', { class: 'question panel is-waiting', dataset: { question: q.id } });

  const options = q.optionList
    .map(
      (opt, i) => `
      <button class="q-option" type="button" data-option="${opt.key}" data-anim style="--d:${
        300 + i * 70
      }ms" title="${OPTION_TITLES[opt.key]}" aria-label="Phương án ${opt.key}: ${opt.text}">
        <span class="q-option__key">${opt.key}</span>
        <span class="q-option__text">${opt.text}</span>
        <span class="q-option__mark">
          <span class="mark-correct">${ICONS.check}</span>
          <span class="mark-wrong">${ICONS.cross}</span>
        </span>
      </button>`
    )
    .join('');

  node.innerHTML = `
    <aside class="q-aside">${elementTile(q.badge)}</aside>
    <div class="q-main">
      <div class="q-head" data-anim style="--d:40ms">
        <span class="q-index">CÂU <b>${String(q.id).padStart(2, '0')}</b> / 07</span>
        <span class="q-part">${q.part}</span>
        <span class="q-score" data-score-wrap>ĐIỂM <b data-score>0</b></span>
      </div>

      <h2 class="q-text" data-anim style="--d:110ms">${q.question}</h2>

      <div class="q-answer" data-answer data-anim style="--d:180ms">
        <span class="q-answer__label">Đáp án đúng:</span>
        <span class="q-answer__value" data-answer-value><span class="dots">• • •</span></span>
        <button class="q-answer__peek" type="button" data-action="reveal" title="Hiện đáp án (R)">Hiện</button>
      </div>

      <div class="q-options">${options}</div>

      <div class="q-foot">
        <span class="q-foot__msg" data-msg>Chọn đáp án bằng cử chỉ hoặc phím A / B / C / D</span>
        <button class="q-foot__next" type="button" data-action="next">
          Câu tiếp theo ${ICONS.arrowRight}
        </button>
      </div>
    </div>
  `;
  return node;
}

/* -------------------------------------------------------------- KẾT THÚC */

/* -------------------------------------------------------------- SLIDE 9 · VIDEO */

/** Slide video kết thúc — tới đây là video tự phát toàn màn hình. */
export function renderVideoSlide() {
  const node = el('article', { class: 'vslide panel' });
  node.innerHTML = `
    <p class="vslide__eyebrow" data-anim style="--d:40ms">${videoSlide.eyebrow}</p>
    <h2 class="vslide__title" data-anim style="--d:90ms">${videoSlide.title}</h2>
    <p class="vslide__sub" data-anim style="--d:150ms">${videoSlide.subline}</p>

    <div class="vslide__stage" data-anim style="--d:210ms">
      <span class="vslide__ring"></span>
      <span class="vslide__ring vslide__ring--2"></span>
      <button class="vslide__play" type="button" data-action="play-video" aria-label="Phát video kết thúc">
        <svg viewBox="0 0 24 24" fill="none"><path d="M8 5.2v13.6L19 12z" fill="currentColor"/></svg>
      </button>
      <span class="vslide__arrow">
        <svg viewBox="0 0 24 24" fill="none"><path d="M6.4 19.6v-5.2c0-1.3.4-2.2 1.3-3.2l.8-.9.8.9c.9 1 1.3 1.9 1.3 3.2v5.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.9 19.6v-5.2c0-1.3.4-2.2 1.3-3.2l.8-.9.8.9c.9 1 1.3 1.9 1.3 3.2v5.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.3 20.4h13.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        <b>GIƠ CẢ 2 TAY</b>
      </span>
    </div>

    <p class="vslide__missing" data-video-note hidden>${videoSlide.missing}</p>

    <div class="vslide__actions" data-anim style="--d:280ms">
      <button class="btn btn--primary" type="button" data-action="play-video">${videoSlide.playLabel}</button>
    </div>
    <p class="vslide__hint" data-anim style="--d:340ms">${videoSlide.hint}</p>
  `;
  return node;
}
