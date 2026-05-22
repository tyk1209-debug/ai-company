const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = process.env.PREVIEW_HOST || '127.0.0.1';
const PORT = Number(process.env.PREVIEW_PORT || 4173);
const ROOT = process.env.PREVIEW_ROOT || process.cwd();

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

function resolveTarget(urlPath) {
  const cleanPath = decodeURIComponent((urlPath || '/').split('?')[0]);
  const normalized = path.normalize(cleanPath).replace(/^(\.\.[/\\])+/, '');
  let target = path.join(ROOT, normalized);

  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, 'index.html');
  }

  return target;
}

const server = http.createServer((req, res) => {
  const target = resolveTarget(req.url);

  if (!target.startsWith(ROOT)) {
    return send(res, 403, 'Forbidden');
  }

  fs.readFile(target, (error, data) => {
    if (error) {
      if (error.code === 'ENOENT') {
        return send(res, 404, 'Not found');
      }
      return send(res, 500, 'Server error');
    }

    const ext = path.extname(target).toLowerCase();
    send(res, 200, data, CONTENT_TYPES[ext] || 'application/octet-stream');
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Preview server running at http://${HOST}:${PORT}`);
  console.log(`Root: ${ROOT}`);
});
