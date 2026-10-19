#!/usr/bin/env node
/**
 * tools/build-preview.mjs
 * Đóng gói toàn bộ CSS + JS ES module thành MỘT file preview.html duy nhất
 * (dùng để xem trước trong khung nhúng không có mạng / không tải được file phụ).
 *
 * Đây chỉ là công cụ tiện ích — bản chạy chính thức vẫn là index.html + các module.
 *   npm run build:preview
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = path.join(ROOT, 'js', 'app.js');

const seen = new Set();
const order = [];

function resolveSpec(fromFile, spec) {
  if (!spec.startsWith('.')) throw new Error(`Không hỗ trợ import package: ${spec}`);
  return path.resolve(path.dirname(fromFile), spec);
}

function loadModule(file) {
  if (seen.has(file)) return;
  seen.add(file);

  let src = fs.readFileSync(file, 'utf8');
  const deps = [];

  src = src.replace(
    /^[ \t]*import\s+[^;]*?from\s+['"]([^'"]+)['"];?[ \t]*$/gm,
    (_match, spec) => {
      deps.push(resolveSpec(file, spec));
      return '';
    }
  );
  src = src.replace(/^[ \t]*import\s+['"]([^'"]+)['"];?[ \t]*$/gm, (_match, spec) => {
    deps.push(resolveSpec(file, spec));
    return '';
  });

  deps.forEach(loadModule);

  src = src.replace(/^export\s+(?=(const|let|var|function|class|async\s+function)\b)/gm, '');
  src = src.replace(/^export\s*\{[^}]*\};?[ \t]*$/gm, '');
  src = src.replace(/^export\s+default\s+/gm, '');

  order.push({ file, src });
}

loadModule(ENTRY);

const bundle = `(function () {\n'use strict';\n/* ==== BUNDLE: ${order
  .map((m) => path.relative(ROOT, m.file))
  .join(' → ')} ==== */\n\n${order.map((m) => `/* ---- ${path.relative(ROOT, m.file)} ---- */\n${m.src}`).join('\n\n')}\n})();\n`;

const cssFiles = fs
  .readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .match(/<link rel="stylesheet" href="([^"]+)"\s*\/?>/g)
  ?.map((tag) => tag.match(/href="([^"]+)"/)[1]) || ['css/base.css'];

const css = cssFiles
  .map((rel) => `/* ==== ${rel} ==== */\n${fs.readFileSync(path.join(ROOT, rel), 'utf8')}`)
  .join('\n\n');

const favicon = fs.readFileSync(path.join(ROOT, 'assets', 'favicon.svg'));
const faviconUri = `data:image/svg+xml;base64,${favicon.toString('base64')}`;

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

html = html.replace(/[ \t]*<link rel="stylesheet"[^>]*>\n?/g, '');
html = html.replace(/<link rel="icon"[^>]*>/, () => `<link rel="icon" href="${faviconUri}" type="image/svg+xml" />`);
html = html.replace(
  '</head>',
  () =>
    `  <style>\n${css}\n  </style>\n  <!-- File xem trước tự chứa: mọi CSS/JS đã được nhúng. Bản chính thức: index.html -->\n</head>`
);
html = html.replace(
  /<script type="module" src="js\/app\.js"><\/script>/,
  () => `<script>\n${bundle}\n</script>`
);
html = html.replace('<html lang="vi">', '<html lang="vi" data-build="preview">');

fs.writeFileSync(path.join(ROOT, 'preview.html'), html);
console.log(`✔ Đã tạo preview.html (${(html.length / 1024).toFixed(0)} KB)`);
console.log(`  Modules: ${order.map((m) => path.relative(ROOT, m.file)).join(', ')}`);
console.log(`  CSS: ${cssFiles.join(', ')}`);
