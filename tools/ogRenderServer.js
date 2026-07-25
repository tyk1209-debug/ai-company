'use strict';

/**
 * OGP画像レンダリング用のローカルサーバー（開発用途のみ・本番では使わない）
 *
 * og-src/render.html をブラウザで開くと、各SVGをcanvasで1200x630のPNGに変換し
 * POST /save で送り返してくる。このサーバーがそれを og/ に書き出す。
 *
 * 使い方:
 *   node tools/ogRenderServer.js   → http://localhost:4545/render.html を開く
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'og-src');
const OUT_DIR = path.join(ROOT, 'og');
const PORT = 4545;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(res, code, body) {
  const payload = JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

function handleSave(req, res) {
  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > 20 * 1024 * 1024) {
      req.destroy();
      return;
    }
    chunks.push(c);
  });
  req.on('end', () => {
    try {
      const { name, dataUrl } = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      // ファイル名はSVGのbasenameに限定し、パス区切りを弾く
      if (!/^[a-z0-9-]+$/.test(String(name))) {
        sendJson(res, 400, { error: 'invalid name' });
        return;
      }
      const base64 = String(dataUrl).replace(/^data:image\/png;base64,/, '');
      if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
      const outPath = path.join(OUT_DIR, `${name}.png`);
      fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
      console.log(`[ogRenderServer] saved og/${name}.png`);
      sendJson(res, 200, { ok: true, file: `og/${name}.png` });
    } catch (err) {
      console.error('[ogRenderServer] save failed:', err.message);
      sendJson(res, 500, { error: err.message });
    }
  });
}

function handleStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const rel = urlPath === '/' ? '/render.html' : urlPath;
  const filePath = path.join(SRC_DIR, rel);
  if (!filePath.startsWith(SRC_DIR) || !fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
  res.end(fs.readFileSync(filePath));
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    handleSave(req, res);
    return;
  }
  handleStatic(req, res);
}).listen(PORT, () => {
  console.log(`[ogRenderServer] listening on http://localhost:${PORT}/render.html`);
});
