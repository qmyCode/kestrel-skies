/** Kestrel Skies - Static File Server for game/ */
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';

const GAME_DIR = resolve('./game');
const PORT = 8080;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.glsl': 'text/plain; charset=utf-8',
  '.vert': 'text/plain; charset=utf-8',
  '.frag': 'text/plain; charset=utf-8',
  '.wgsl': 'text/plain; charset=utf-8',
};

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

function isSafePath(requestPath: string): boolean {
  const normalized = resolve(GAME_DIR, requestPath);
  return normalized.startsWith(GAME_DIR);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  let pathname = url.pathname;

  // Default to index.html
  if (pathname === '/') pathname = '/index.html';

  // Security: prevent path traversal
  if (!isSafePath(pathname.slice(1))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const filePath = join(GAME_DIR, pathname.slice(1));

  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const content = readFileSync(filePath);
    const mime = getMimeType(filePath);

    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': content.length,
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // Try index.html for SPA-like routing
      if (pathname !== '/index.html') {
        try {
          const indexPath = join(GAME_DIR, 'index.html');
          const content = readFileSync(indexPath);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
          return;
        } catch {}
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }
});

server.listen(PORT, () => {
  console.log(`Kestrel Skies server running at http://localhost:${PORT}`);
  console.log(`Serving ${GAME_DIR}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  server.close(() => {
    console.log('\nServer stopped');
    process.exit(0);
  });
});