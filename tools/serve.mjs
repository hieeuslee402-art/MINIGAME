#!/usr/bin/env node
/**
 * tools/serve.mjs — máy chủ tĩnh tối giản, không cần cài dependency.
 * Chạy: npm start  →  http://localhost:3000
 * Camera hoạt động trên http://localhost (được coi là secure context).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.binarypb': 'application/octet-stream',
  '.tflite': 'application/octet-stream',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let filePath = path.join(ROOT, urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) filePath = path.join(filePath, 'index.html');

    fs.stat(filePath, (statErr, fileStat) => {
      if (statErr || !fileStat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 — không tìm thấy: ' + urlPath);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const type = MIME[ext] || 'application/octet-stream';
      const headers = {
        'Content-Type': type,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Accept-Ranges': 'bytes',
      };

      // Range: cần cho <video>/<audio> tua và phát mượt (outro.mp4, dung.mp3…)
      const range = req.headers.range;
      if (range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
        if (m) {
          const size = fileStat.size;
          let start = m[1] === '' ? size - Number(m[2] || 0) : Number(m[1]);
          let end = m[2] === '' || m[1] === '' ? size - 1 : Number(m[2]);
          start = Math.max(0, Math.min(start, size - 1));
          end = Math.max(start, Math.min(end, size - 1));
          res.writeHead(206, {
            ...headers,
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Content-Length': end - start + 1,
          });
          if (req.method === 'HEAD') return res.end();
          fs.createReadStream(filePath, { start, end }).pipe(res);
          return;
        }
      }

      res.writeHead(200, { ...headers, 'Content-Length': fileStat.size });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(filePath).pipe(res);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`\n  ⚗️  MINI GAME PHÚ DƯỠNG — TỔ 1`);
  console.log(`  ➜  http://localhost:${PORT}\n`);
  console.log(`  Camera cần HTTPS hoặc localhost. Khi đưa lên GitHub Pages sẽ tự có HTTPS.\n`);
});
