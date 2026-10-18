/**
 * utils/dom.js — các hàm DOM & tiện ích dùng chung.
 */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/** Tạo phần tử nhanh: el('div', {class: 'a'}, ['text']) */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Chạy hàm 1 lần sau khi người dùng ngừng gọi trong khoảng delay. */
export function debounce(fn, delay = 200) {
  let timer = null;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

/** Chạy hàm tối đa 1 lần mỗi khoảng ms. */
export function throttle(fn, interval = 100) {
  let last = 0;
  return (...args) => {
    const now = performance.now();
    if (now - last >= interval) {
      last = now;
      fn(...args);
    }
  };
}

/** Kích hoạt lại hiệu ứng CSS animation bằng cách gỡ/gắn class. */
export function replayAnimation(node, className, duration = 700) {
  if (!node) return;
  node.classList.remove(className);
  void node.offsetWidth; // reflow
  node.classList.add(className);
  clearTimeout(node._animTimer);
  node._animTimer = setTimeout(() => node.classList.remove(className), duration);
}

export function setText(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}

/** Phát sự kiện tuỳ biến gọn gàng. */
export function emit(target, name, detail) {
  target.dispatchEvent(new CustomEvent(name, { detail }));
}
