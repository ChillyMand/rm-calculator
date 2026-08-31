import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const server = createServer(async (request, response) => {
  const urlPath = request.url === '/' ? '/index.html' : request.url;
  const filePath = normalize(join(root, urlPath));
  if (!filePath.startsWith(root)) { response.writeHead(403); response.end('Forbidden'); return; }
  try { const body = await readFile(filePath); response.writeHead(200, { 'Content-Type': types[extname(filePath)] || 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' }); response.end(body); }
  catch { response.writeHead(404); response.end('Not found'); }
});
const port = Number(process.env.RM_PORT || 5173);
server.listen(port, '127.0.0.1', () => console.log(`RM calculator running at http://127.0.0.1:${port}/`));
