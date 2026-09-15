import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { assets, csp } from './mobile-assets.mjs';
import { iconPNG } from './mobile-icons.mjs';
export function buildMobileTest(destination) {
  const repo = path.resolve(import.meta.dirname,'..');
  // Destination must be fresh; never merge old release contents or secrets.
  fs.mkdirSync(destination, {recursive:false});
  const site = path.join(destination,'site'); fs.mkdirSync(site);
  const contents = new Map();
  for (const file of assets.keys()) {
    const icon = /^icon-(180|192|512)\.png$/.exec(file);
    contents.set(file, icon ? iconPNG(Number(icon[1])) : fs.readFileSync(path.join(repo,'prototype',file)));
  }
  const release = crypto.createHash('sha256');
  for (const [file,bytes] of contents) release.update(file).update(bytes);
  const version = release.digest('hex').slice(0,16);
  contents.set('sw.js',Buffer.from(contents.get('sw.js').toString().replace("'BUILD_VERSION'",`'${version}'`)));
  for (const [file,bytes] of contents) fs.writeFileSync(path.join(site,file),bytes,{flag:'wx'});
  // Supported by some static hosts; generic hosts must configure these headers separately.
  fs.writeFileSync(path.join(site,'_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-cache\n  Content-Security-Policy: ${csp}\n`);
  fs.copyFileSync(path.join(repo,'docs','mobile-test-deployment.md'),path.join(destination,'DEPLOYMENT.md'));
  const files = {};
  for (const file of [...assets.keys(),'_headers']) {
    const bytes=fs.readFileSync(path.join(site,file));
    files[`site/${file}`]={bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
  }
  const guide=fs.readFileSync(path.join(destination,'DEPLOYMENT.md'));
  files['DEPLOYMENT.md']={bytes:guide.length,sha256:crypto.createHash('sha256').update(guide).digest('hex')};
  fs.writeFileSync(path.join(destination,'release.json'),JSON.stringify({version,kind:'fictional-single-device-demo',builtAt:new Date().toISOString(),files},null,2));
  return {directory:destination,site,version};
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const dist=path.resolve(import.meta.dirname,'../dist'); fs.mkdirSync(dist,{recursive:true});
  const directory=path.join(dist,'Pet-store-mobile-test-'+new Date().toISOString().replace(/[:.]/g,'-'));
  console.log(JSON.stringify(buildMobileTest(directory)));
}
