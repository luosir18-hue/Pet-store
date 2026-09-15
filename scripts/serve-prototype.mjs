import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { assets, csp } from './mobile-assets.mjs';
import { iconPNG } from './mobile-icons.mjs';

const defaultRoot = path.resolve(import.meta.dirname, '../prototype');
export function createServer(root = defaultRoot) {
  return http.createServer((req,res) => {
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405,{'Allow':'GET, HEAD'}); res.end(); return; }
    let pathname;
    try { pathname = new URL(req.url, 'http://127.0.0.1').pathname; }
    catch { res.writeHead(400); res.end(); return; }
    const file = pathname === '/' ? 'index.html' : pathname.slice(1);
    const type = assets.get(file);
    if (!type) { res.writeHead(404); res.end('Not found'); return; }
    const icon = /^icon-(180|192|512)\.png$/.exec(file);
    const full = path.join(root,file);
    if (!icon && !fs.existsSync(full)) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type':type.startsWith('image/') ? type : `${type}; charset=utf-8`, 'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer',
      'Content-Security-Policy':csp,
    });
    if (req.method === 'HEAD') { res.end(); return; }
    let bytes = icon && !fs.existsSync(full) ? iconPNG(Number(icon[1])) : fs.readFileSync(full);
    if (file === 'sw.js' && bytes.toString().includes("'BUILD_VERSION'")) {
      const digest = crypto.createHash('sha256');
      for (const asset of assets.keys()) {
        const generated = /^icon-(180|192|512)\.png$/.exec(asset);
        digest.update(asset).update(generated ? iconPNG(Number(generated[1])) : fs.readFileSync(path.join(root,asset)));
      }
      bytes = Buffer.from(bytes.toString().replace("'BUILD_VERSION'",`'${digest.digest('hex').slice(0,16)}'`));
    }
    res.end(bytes);
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.PET_PROTOTYPE_PORT || 4173);
  const server = createServer(process.env.PET_PROTOTYPE_ROOT ? path.resolve(process.env.PET_PROTOTYPE_ROOT) : defaultRoot);
  server.on('error', e => { console.error(`Prototype server: ${e.message}`); process.exitCode = 1; });
  server.listen(port,'127.0.0.1',() => console.log(`Fictional prototype only: http://127.0.0.1:${port}`));
}
