/**
 * ui/deck.js
 * Quản lý bộ slide: mount, chuyển slide, hiệu ứng trượt, aria.
 */
import { el } from '../utils/dom.js';

export class Deck {
  constructor(container, definitions) {
    this.container = container;
    this.definitions = definitions;
    this.nodes = [];
    this.index = -1;
    this.onChange = null;
    this._leaveTimer = null;
  }

  mount() {
    this.definitions.forEach((def, i) => {
      const slide = el('section', {
        class: 'slide',
        id: `slide-${def.id}`,
        role: 'group',
        'aria-roledescription': 'slide',
        'aria-label': `${def.label} — ${i + 1}/${this.definitions.length}`,
        dataset: { index: i, type: def.type, id: def.id },
        'aria-hidden': 'true',
      });
      const inner = el('div', { class: 'slide__inner' });
      inner.append(def.render());
      slide.append(inner);
      slide.inert = true;
      this.container.append(slide);
      this.nodes.push(slide);
    });
  }

  get current() {
    return this.nodes[this.index];
  }

  get type() {
    return this.current?.dataset.type;
  }

  goto(index, direction = 1) {
    const total = this.nodes.length;
    const target = Math.max(0, Math.min(total - 1, index));
    if (target === this.index) return false;

    const previous = this.nodes[this.index];
    const next = this.nodes[target];

    clearTimeout(this._leaveTimer);

    if (previous) {
      previous.classList.remove('is-active');
      previous.classList.add(direction >= 0 ? 'is-leaving' : 'is-leaving-back');
      previous.inert = true;
      previous.setAttribute('aria-hidden', 'true');
      this._leaveTimer = setTimeout(() => previous.classList.remove('is-leaving', 'is-leaving-back'), 720);
    }

    next.classList.remove('is-leaving', 'is-leaving-back');
    // ép trình duyệt tính lại style để animation vào chạy lại mỗi lần quay lại slide
    void next.offsetWidth;
    next.classList.add('is-active');
    next.inert = false;
    next.setAttribute('aria-hidden', 'false');

    const inner = next.querySelector('.slide__inner');
    if (inner) inner.scrollTop = 0;

    const prevIndex = this.index;
    this.index = target;
    this.onChange?.(target, prevIndex, direction);
    return true;
  }

  next() {
    return this.goto(this.index + 1, 1);
  }

  prev() {
    return this.goto(this.index - 1, -1);
  }

  first() {
    return this.goto(0, -1);
  }
}
