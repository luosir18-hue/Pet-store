import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createDemo, advancePet, confirmPayment, submitBooking, extendStay, saveCare, advanceLeg } from '../prototype/model.mjs';
import { createServer } from '../scripts/serve-prototype.mjs';

test('one pet completion does not complete its sibling, handover or payment', () => {
  const s=createDemo(); advancePet(s,'dog-demo'); advancePet(s,'dog-demo');
  assert.equal(s.pets[0].status,'已完成'); assert.equal(s.pets[1].status,'已到店'); assert.equal(s.paid,false);
});
test('manual payment requires confirmation and is repeat-safe in demo memory', () => {
  const s=createDemo(); assert.throws(()=>confirmPayment(s,false)); assert.equal(s.paid,false);
  assert.equal(confirmPayment(s,true),true); assert.equal(confirmPayment(s,true),false);
  assert.equal(s.pets[0].status,'已到店');
});
test('conflicting extension preserves both reservations', () => {
  const s=createDemo(),before=structuredClone(s.boarding);
  assert.throws(()=>extendStay(s,'cat-room','2026-09-17'),/冲突/); assert.deepEqual(s.boarding,before);
});
test('nonconflicting extension and adjacent half-open boundary succeed', () => {
  const s=createDemo(); extendStay(s,'dog-room','2026-09-16'); assert.equal(s.boarding[1].end,'2026-09-16');
  extendStay(s,'dog-room','2026-09-20'); assert.equal(s.boarding[1].end,'2026-09-20');
});
test('care is never silently populated as normal', () => {
  const s=createDemo(); assert.equal(s.boarding[0].care,''); assert.throws(()=>saveCare(s,'cat-room','  '));
  saveCare(s,'cat-room','虚构：饮水已更换'); assert.equal(s.boarding[0].care,'虚构：饮水已更换');
});
test('roundtrip legs advance independently', () => {
  const s=createDemo(),back=structuredClone(s.legs[1]);
  for(let i=0;i<3;i++) advanceLeg(s,'outbound');
  assert.equal(s.legs[0].status,'已送达'); assert.deepEqual(s.legs[1],back);
});
const booking={key:'example',petNames:'示例猫、示例狗',service:'洗澡护理',date:'2026-09-15',window:'上午',end:'2026-09-17',transport:'无需接送',address:'',returnAddress:''};
test('new multi-pet request is pending with unknown quote and no identity claim', () => {
  const s=createDemo(),r=submitBooking(s,booking);
  assert.equal(r.names.length,2); assert.equal(r.status,'待老板确认'); assert.equal(r.quote,null);
  assert.equal(r.address,null); assert.equal(r.end,null); assert.equal(r.customerId,undefined);
});
test('same demo submission key repeats once, distinct keys remain separate', () => {
  const s=createDemo(); submitBooking(s,booking); submitBooking(s,booking); assert.equal(s.requests.length,1);
  submitBooking(s,{...booking,key:'different'}); assert.equal(s.requests.length,2);
});
test('transport and boarding validate conditional inputs', () => {
  const s=createDemo();
  assert.throws(()=>submitBooking(s,{...booking,transport:'往返接送',address:'示例门口'}),/送回/);
  assert.throws(()=>submitBooking(s,{...booking,service:'寄养',end:'2026-09-14'}),/离店/);
  assert.throws(()=>submitBooking(s,{...booking,window:'凌晨'}),/时段/);
});
test('fresh demo is independent of prior interactions', () => {
  const s=createDemo(); confirmPayment(s,true); assert.equal(createDemo().paid,false);
});
test('HTTP serves only prototype assets, never repo, private files or writes', async t => {
  const server=createServer(); server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const root=`http://127.0.0.1:${server.address().port}`;
  for(const route of ['/','/app.mjs','/model.mjs','/style.css']) { const r=await fetch(root+route); assert.equal(r.status,200); await r.text(); }
  const sw = await (await fetch(root+'/sw.js')).text(); assert.ok(!sw.includes("'BUILD_VERSION'"));
  for(const route of ['/.git/config','/work/legacy-source/app.js','/salon.db','/docs/business-rules.md','/..%2f.git/config']) {
    const r=await fetch(root+route); assert.equal(r.status,404); await r.text();
  }
  const r=await fetch(root,{method:'POST'}); assert.equal(r.status,405); await r.text();
});
