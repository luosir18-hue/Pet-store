// Compare only the three exact sources placed in scope by the user.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.argv[2];
if(!root) throw new Error('Usage: node scripts/verify-backup.mjs <backup-directory>');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function inventory(base) {
  const result=new Map();
  function walk(dir) {
    for(const item of fs.readdirSync(dir,{withFileTypes:true})) {
      const full=path.join(dir,item.name);
      if(item.isSymbolicLink()) throw new Error('Unexpected link: review source before continuing');
      if(item.isDirectory()) walk(full);
      else if(item.isFile()) result.set(path.relative(base,full),{size:fs.statSync(full).size,hash:sha(full)});
    }
  }
  walk(base); return result;
}
const pairs=[['installation','D:/宠物店',path.join(root,'安装目录/宠物店')],
  ['userdata','C:/Users/ZhuanZ/AppData/Roaming/pet-salon-records',path.join(root,'用户数据/pet-salon-records')]];
let valid=true;
for(const [part,source,target] of pairs) {
  const a=inventory(source),b=inventory(target);
  let missing=0,extra=0,mismatch=0,totalBytes=0;
  for(const [file,x] of a) { totalBytes+=x.size; if(!b.has(file)) missing++; else if(x.size!==b.get(file).size||x.hash!==b.get(file).hash) mismatch++; }
  for(const file of b.keys()) if(!a.has(file)) extra++;
  valid=valid&&missing+extra+mismatch===0;
  console.log(JSON.stringify({part,sourceFiles:a.size,backupFiles:b.size,totalBytes,missing,extra,mismatch}));
}
const shortcut='C:/Users/ZhuanZ/Desktop/宠物店收银与会员.lnk';
const match=sha(shortcut)===sha(path.join(root,'桌面快捷方式/宠物店收银与会员.lnk'));
console.log(JSON.stringify({part:'shortcut',files:1,bytes:fs.statSync(shortcut).size,sha256Matches:match}));
if(!valid||!match) process.exitCode=1;
console.log('Read-only content comparison. NTFS ownership/auditing and bootable restore are not verified.');
