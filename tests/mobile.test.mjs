import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { once } from 'node:events';
import { createDemo, advancePet, confirmPayment, extendStay, saveCare, advanceLeg, submitBooking } from '../prototype/model.mjs';
import { STORAGE_KEY, decodeSnapshot, readDemo, writeDemo } from '../prototype/demo-storage.mjs';
import { buildMobileTest } from '../scripts/build-mobile-test.mjs';
import { assets } from '../scripts/mobile-assets.mjs';
import { createServer } from '../scripts/serve-prototype.mjs';
const encode = state => JSON.stringify({version:1,state});
const fakeStorage = () => { const map=new Map(); return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)}; };
test('all five flows survive local snapshot reload, not another device', () => {
  const state=createDemo(),storage=fakeStorage();
  advancePet(state,'dog-demo'); confirmPayment(state,true); extendStay(state,'dog-room','2026-09-16');
  saveCare(state,'cat-room','虚构照护'); advanceLeg(state,'outbound');
  submitBooking(state,{key:'first',petNames:'示例猫、示例狗',service:'寄养',date:'2026-09-15',end:'2026-09-17',window:'上午',transport:'往返接送',address:'示例门甲',returnAddress:'示例门乙'});
  assert.equal(writeDemo(storage,state),true);
  assert.deepEqual(readDemo(storage).state,state);
  assert.deepEqual(readDemo(fakeStorage()).state,createDemo());
  writeDemo(storage,createDemo()); assert.deepEqual(readDemo(storage).state,createDemo());
});
test('corrupt, oversized and unsupported storage falls back visibly', () => {
  for (const raw of ['broken',JSON.stringify({version:99,state:createDemo()}),'x'.repeat(100001),encode({})]) {
    const storage=fakeStorage(); storage.setItem(STORAGE_KEY,raw);
    assert.deepEqual(readDemo(storage).state,createDemo());
    assert.match(readDemo(storage).message,/不可读取/);
  }
});
test('blocked storage does not masquerade as a successful save', () => {
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};
  assert.equal(writeDemo(blocked,createDemo()),false);
  assert.match(readDemo(blocked).message,/不可读取/);
  assert.equal(writeDemo(null,createDemo()),false);
});
test('snapshot rebuild never imports arbitrary fixed labels or prices', () => {
  const raw=createDemo(); raw.pets[0].name='<img src=x onerror=alert(1)>'; raw.pets[0].cents=-999; raw.legs[0].person='forged';
  assert.deepEqual(decodeSnapshot(encode(raw)),createDemo());
  raw.pets[0].status='forged'; assert.throws(()=>decodeSnapshot(encode(raw)));
});
test('invalid stored boarding and duplicate requests are rejected', () => {
  const raw=createDemo(); raw.boarding[0].end='2026-09-17'; assert.throws(()=>decodeSnapshot(encode(raw)),/冲突/);
  raw.boarding[0].end='2026-09-16'; raw.boarding[0].care='x'.repeat(501); assert.throws(()=>decodeSnapshot(encode(raw)));
  raw.boarding[0].care='';
  submitBooking(raw,{key:'same',petNames:'示例',service:'洗澡护理',date:'2026-09-15',window:'下午',transport:'无需接送'});
  raw.requests.push(raw.requests[0]); assert.throws(()=>decodeSnapshot(encode(raw)),/invalid request/);
});
test('release whitelist, content hashes, icons and MIME are complete', async t => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pet-release-test-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  const release=buildMobileTest(path.join(temp,'release'));
  const again=buildMobileTest(path.join(temp,'again')); assert.equal(release.version,again.version);
  assert.throws(()=>buildMobileTest(release.directory));
  const manifest=JSON.parse(fs.readFileSync(path.join(release.directory,'release.json')));
  assert.deepEqual(fs.readdirSync(release.site).sort(),[...assets.keys(),'_headers'].sort());
  for (const [file,entry] of Object.entries(manifest.files)) {
    const bytes=fs.readFileSync(path.join(release.directory,file));
    assert.equal(bytes.length,entry.bytes); assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256);
  }
  for (const size of [180,192,512]) {
    const png=fs.readFileSync(path.join(release.site,`icon-${size}.png`));
    assert.equal(png.subarray(1,4).toString(),'PNG'); assert.equal(png.readUInt32BE(16),size); assert.equal(png.readUInt32BE(20),size);
  }
  const server=createServer(release.site); server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  for(const [file,type] of assets) {
    const response=await fetch(`http://127.0.0.1:${server.address().port}/${file}`);
    assert.equal(response.status,200); assert.ok(response.headers.get('content-type').startsWith(type));
    await response.arrayBuffer();
  }
  const sw=fs.readFileSync(path.join(release.site,'sw.js'),'utf8');
  assert.ok(sw.includes(release.version)); assert.ok(!sw.includes("'BUILD_VERSION'"));
});
function workerHarness(scope) {
  const events={},stores=new Map([['unrelated-cache',new Map()]]);
  let claimed=false,skipped=false;
  const caches={
    async keys(){return [...stores.keys()];}, async delete(key){return stores.delete(key);},
    async open(name){ if(!stores.has(name)) stores.set(name,new Map()); const map=stores.get(name); return {
      async addAll(urls){ for(const url of urls) map.set(url,new Response('cached:'+url)); },
      async match(url){ return map.get(url)?.clone(); },
    }; },
  };
  const self={registration:{scope},addEventListener:(name,fn)=>events[name]=fn,clients:{async claim(){claimed=true;}},skipWaiting(){skipped=true;}};
  const script=fs.readFileSync(new URL('../prototype/sw.js',import.meta.url),'utf8').replace("'BUILD_VERSION'","'test-release'");
  vm.runInNewContext(script,{self,caches,URL,fetch:()=>{throw Error('offline');}});
  return {events,stores,get claimed(){return claimed;},get skipped(){return skipped;}};
}
test('service worker precaches and serves all page assets offline at root and subpath', async () => {
  for(const scope of ['https://demo.example/','https://demo.example/pet/']) {
    const worker=workerHarness(scope); let pending;
    worker.events.install({waitUntil:p=>pending=p}); await pending;
    assert.equal(worker.skipped,false);
    worker.events.activate({waitUntil:p=>pending=p}); await pending;
    assert.equal(worker.claimed,true); assert.ok(worker.stores.has('unrelated-cache'));
    for(const file of ['',...assets.keys()].filter(f=>f!=='sw.js')) {
      let response;
      worker.events.fetch({request:{url:scope+file,method:'GET'},respondWith:p=>response=p});
      assert.ok(response); assert.match(await (await response).text(),/^cached:/);
    }
    for(const url of ['https://other.example/app.mjs',scope+'api/orders',scope+'index.html?secret=yes']) {
      let intercepted=false;worker.events.fetch({request:{url,method:'GET'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
    }
    let intercepted=false; worker.events.fetch({request:{url:scope,method:'POST'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
    worker.events.message({data:{type:'ACTIVATE_DEMO_UPDATE'}});assert.equal(worker.skipped,true);
  }
});
test('activation clears only older caches for its own scope', async () => {
  const scope='https://demo.example/pet/',worker=workerHarness(scope);
  const ownOld='pet-store-phone-demo:'+scope+':old';
  const other='pet-store-phone-demo:https://demo.example/other/:old';
  worker.stores.set(ownOld,new Map()); worker.stores.set(other,new Map());
  let pending;worker.events.activate({waitUntil:p=>pending=p});await pending;
  assert.equal(worker.stores.has(ownOld),false);assert.equal(worker.stores.has(other),true);
});
test('first installation does not advertise an update, existing controller does', async () => {
  const script=fs.readFileSync(new URL('../prototype/mobile.mjs',import.meta.url),'utf8');
  for (const hasController of [false,true]) {
    const status={textContent:''},button={hidden:true,addEventListener(){}};
    const registration={waiting:{postMessage(){}},addEventListener(){}};
    const serviceWorker={controller:hasController?{}:null,async register(){return registration;},ready:Promise.resolve(registration),addEventListener(){}};
    await vm.runInNewContext(script,{document:{querySelector:s=>s==='#offline-status'?status:button},
      window:{isSecureContext:true,addEventListener(){}},navigator:{serviceWorker,onLine:true},setTimeout,clearTimeout});
    assert.equal(button.hidden,!hasController);
  }
});
