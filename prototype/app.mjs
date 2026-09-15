import { createDemo, advancePet, confirmPayment, submitBooking, extendStay, saveCare, advanceLeg } from './model.mjs';
import { readDemo, writeDemo, STORAGE_KEY } from './demo-storage.mjs';

let storage;
try { storage = window.localStorage; } catch { storage = null; }
const restored = readDemo(storage);
let state = restored.state;
const nextKey = () => `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
let requestKey = nextKey();
const storageStatus = document.querySelector('#storage-status');
storageStatus.textContent = restored.message;
function persist() {
  storageStatus.textContent = writeDemo(storage, state)
    ? '本机演示已保存 · 不同步其他手机 · 不是营业备份'
    : '本次仅保留在页面内存：本机保存失败，关闭或刷新可能丢失。';
}
let messageTimer;
const main = document.querySelector('#main');
const notice = document.querySelector('#notice');
const money = cents => `¥${(cents / 100).toFixed(2)}`;
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const badge = (text, tone = '') => `<span class="badge ${tone}">${escape(text)}</span>`;
const button = (action, text, id = '', secondary = false) => `<button type="button" data-action="${action}" data-id="${id}" class="${secondary ? 'secondary' : ''}">${text}</button>`;
const heading = (kicker, title, description) => `<div class="heading"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p class="muted">${description}</p></div></div>`;
const petAction = status => ({'已到店':'开始服务','服务中':'完成服务','已完成':'确认交还','已交还':'已交还'})[status];
const legAction = status => ({'待安排':'确认演示派单','已安排':'开始出发','前往交接':'确认已接宠','已接宠':'确认送达','已送达':'已送达'})[status];

function showMessage(text) {
  clearTimeout(messageTimer);
  notice.textContent = text;
  notice.hidden = false;
  messageTimer = setTimeout(() => { notice.hidden = true; }, 5500);
}

function today() {
  return `${heading('老板工作台 · 示例 9月14日', '今天，先把这些事做好', '接待、照护与接送，都从这里开始。')}
    <div class="stats">
      <div class="stat"><span>待确认申请</span><strong>${state.requests.length}</strong></div>
      <div class="stat"><span>待完成服务</span><strong>${state.pets.filter(p => !['已完成','已交还'].includes(p.status)).length}</strong></div>
      <div class="stat"><span>寄养待照护</span><strong>${state.boarding.filter(b => !b.care).length}</strong></div>
      <div class="stat"><span>未完成接送</span><strong>${state.legs.filter(l => l.status !== '已送达').length}</strong></div>
    </div>
    <div class="columns"><section class="card"><h2>接下来要做</h2>
      <div class="row"><span class="pet-icon" aria-hidden="true">🐾</span><div class="row-main"><h3>豆包 & 糯米</h3><p class="muted">林女士（虚构） · 两只宠物，一张订单</p><p>${badge(state.paid ? '已登记演示收款' : '未收款', state.paid ? '' : 'amber')}</p></div>${button('order','打开订单')}</div>
      <div class="row"><span class="pet-icon" aria-hidden="true">宿</span><div class="row-main"><h3>布丁 · 今日照护</h3><p class="muted">${state.boarding[0].care ? '已有演示照护记录' : '饮食与状态还没记录'}</p></div>${button('boarding','记录照护','',true)}</div>
      <div class="row"><span class="pet-icon" aria-hidden="true">送</span><div class="row-main"><h3>团团 · 往返接送</h3><p class="muted">接来：${state.legs[0].status} / 送回：${state.legs[1].status}</p></div>${button('transport','查看行程','',true)}</div>
    </section><aside class="stack"><section class="card"><h2>客人预约申请</h2>
      ${state.requests.length ? state.requests.map(r => `<div class="row"><div class="row-main"><h3>${escape(r.names.join('、'))}</h3><p class="muted">${escape(r.service)} · ${escape(r.date)} ${escape(r.window)}</p><p>${badge(r.status,'amber')}</p><p class="muted">报价待确认 · ${escape(r.transport)}</p></div></div>`).join('') : '<p class="muted">还没有演示申请。先体验一次客人预约，提交后会出现在这里。</p>'}
      <div class="actions">${button('booking','体验客人预约','',true)}</div></section>
      <section class="card"><h2>今天的收款</h2><p class="total">${state.paid ? '¥160.00' : '¥0.00'}</p><p class="muted">人工登记 · 仅本页演示</p><p>待收：${state.paid ? '¥0.00' : '¥160.00'}</p></section></aside></div>`;
}

function order() {
  return `${heading('老板视角 · DEMO-ORDER-01', '一页接待，两只宠物', '林女士（虚构） · 档案已带出，只需确认本次变化。')}
    <div class="columns"><div class="stack"><section class="card"><h2>本次服务</h2>
      ${state.pets.map(p => `<div class="row"><span class="pet-icon" aria-hidden="true">${p.id === 'dog-demo' ? '🐕' : '🐈'}</span><div class="row-main"><h3>${p.name} <span class="muted">${p.kind}</span></h3><p>${p.service} · ${money(p.cents)}</p>${badge(p.status)}</div>${p.status === '已交还' ? '' : button('pet',petAction(p.status),p.id)}</div>`).join('')}
      <p class="muted">每只宠物分别记录进度；服务完成后，仍需确认交还。</p></section>
      <section class="card"><h2>已带出的资料</h2><div class="detail"><div><span>客户</span>林女士（虚构）</div><div><span>到店方式</span>主人自行送到</div><div><span>豆包的照护提示</span>演示：吹风时需慢慢适应</div><div><span>本次接宠查验</span>待店员实际核实</div></div><p class="muted">历史信息仅供接待参考，本次健康查验需另行记录。</p></section></div>
    <aside class="stack"><section class="card"><h2>本次费用</h2><div class="row"><span>豆包 · 洗澡护理</span><strong>¥98.00</strong></div><div class="row"><span>糯米 · 基础护理</span><strong>¥62.00</strong></div><div class="row"><strong>应收合计</strong><span class="total">¥160.00</span></div><p>${badge(state.paid ? '已登记演示收款' : '未收款',state.paid ? '' : 'amber')}</p><p class="muted">以上均为虚构已确认报价。正式报价由老板确认。</p>
    ${state.paid ? '<p>演示收款：人工登记 ¥160.00<br>服务与交还进度保持独立。</p>' : button('payment','核实并登记收款')}
    </section><section class="card"><h2>后续能力</h2><p class="muted">会员扣款、组合付款、退款和审计将在真实账本切片中实现。本原型不模拟可用余额。</p></section></aside></div>`;
}

function booking() {
  const recent = state.requests.at(-1);
  return `${heading('客人视角 · 示例门店', '给小家伙安排一次照顾', '先告诉我们需要什么，具体时间与价格由老板确认。')}
    ${recent ? `<section class="success" role="status"><h2>演示申请 ${recent.id}：待老板确认</h2><p>${escape(recent.names.join('、'))} · ${escape(recent.service)} · ${escape(recent.date)}</p><p>尚未锁定时间或笼位，尚未确认费用。没有发送任何真实通知。</p>${button('today','去老板工作台查看','',true)}</section>` : ''}
    <div class="columns"><form id="booking-form" class="card"><h2>预约需求</h2>
      <p class="muted">仅填写虚构资料；正式版本再接入联系方式和身份验证。</p>
      <div class="form-grid"><label class="wide">宠物称呼（多只用“、”分开）<input name="petNames" value="泡芙、栗子" maxlength="120" required></label>
      <label>需要的服务<select name="service" id="service-select"><option>洗澡护理</option><option>美容修剪</option><option>寄养</option></select></label>
      <label>期望日期<input name="date" type="date" value="2026-09-15" min="2026-09-14" max="2026-09-30" required></label>
      <label>期望时段<select name="window"><option>上午</option><option>下午</option></select></label>
      <label id="boarding-field" hidden>预计离店日期<input name="end" type="date" value="2026-09-17" min="2026-09-15" max="2026-09-30"></label>
      <label class="wide">是否需要接送<select name="transport" id="transport-select"><option>无需接送</option><option>单程接来</option><option>往返接送</option></select></label>
      <label id="address-field" class="wide" hidden>示例接宠地点<input name="address" maxlength="100" placeholder="例如：示例小区北门"></label>
      <label id="return-field" class="wide" hidden>示例送回地点<input name="returnAddress" maxlength="100" placeholder="可与接宠地点不同"></label></div>
      <p id="booking-error" class="error" role="alert"></p><label class="check"><input type="checkbox" required> 我知道这是虚构演示，提交后仍需老板确认</label><button type="submit">提交演示申请</button>
    </form><aside class="stack"><section class="card"><h2>费用与安排</h2><p class="total">待确认</p><p class="muted">洗护、美容按宠物情况报价。寄养空位、接送时间与费用需由门店确认。</p></section><section class="card"><h2>这次只填需要的信息</h2><p class="muted">选了接送才填写交接地点；选了寄养才填写离店日期。正式版本验证身份后可复用自己的宠物资料。</p><p class="muted">本原型不提供手机号查历史、余额或真实身份登录。</p></section></aside></div>`;
}

function boarding() {
  return `${heading('老板视角 · 9月14日至18日', '寄养安排，看得见的照顾', '两个虚构笼位，仅演示占位、延住冲突与照护记录。')}
    <div class="alert">演示采用日期半开区间，暂不计算真实寄养费用或清洁缓冲。营业容量、计费和清洁规则等待老板确认。</div>
    <div class="columns">${state.boarding.map(s => `<section class="card"><h2>${s.room} · ${s.pet}</h2>${badge('演示：已入住')}
      <p class="muted">入住 ${s.start} / 预计离店 <strong>${s.end}</strong></p>
      <div class="calendar">${[14,15,16,17,18].map(d => { const day = `2026-09-${d}`; const occupied = day >= s.start && day < s.end; const next = day >= s.nextStart; return `<div class="day ${occupied ? 'occupied' : next ? 'next' : ''}">9/${d}<br>${occupied ? s.pet : next ? '后续预订' : '示例空闲'}</div>`; }).join('')}</div>
      <p class="muted">后续预订起始：${s.nextStart}</p>
      ${button('extend',s.id === 'cat-room' ? '尝试延至17日（有冲突）' : '演示延住一天',s.id,true)}
      <hr><h3>今天的照护</h3><p>${s.care ? badge('已记演示照护') : badge('待实际记录','amber')}</p>
      ${s.care ? `<p>${escape(s.care)}</p>` : `<form data-care="${s.id}"><label>实际做了什么、观察到什么<textarea name="note" maxlength="500" placeholder="仅填写虚构照护情况，不默认正常" required></textarea></label><p><button type="submit">保存演示照护</button></p></form>`}
    </section>`).join('')}</div>`;
}

function transport() {
  return `${heading('接送页面样式预览 · 非权限系统', '接来与送回，分别安排', '示例宠物：团团 · 往返两段可以是不同日期、地点和执行人。')}
    <div class="alert">此处展示两位执行人的虚构任务，便于评审。正式系统中，执行人只能看到分配给自己的任务。</div>
    <div class="columns">${state.legs.map((l,i) => `<section class="card"><h2><span class="leg-number">${i+1}</span>${l.direction}</h2>${badge(l.status,l.status === '待安排' ? 'amber':'')}
      <p class="route">${l.origin} → ${l.destination}</p><div class="detail"><div><span>日期 / 时间窗口</span>${l.day}<br>${l.window}</div><div><span>执行人</span>${l.person}</div></div><p>团团 · 猫 · 1只（虚构）</p><p class="muted">交接提示：核对宠物及携带物品；异常及时联系老板。</p>
      ${l.status === '已送达' ? '<p>本段已完成，另一段保持原状态。</p>' : button('leg',legAction(l.status),l.id)}
      <p class="muted">联系方式与接送费用不在此虚构演示中采集。</p></section>`).join('')}</div>`;
}

const pages = { today, order, booking, boarding, transport };
function render() {
  const page = location.hash.slice(1) || 'today';
  main.innerHTML = (pages[page] || today)();
  document.querySelectorAll('.nav a').forEach(a => {
    if (a.hash === `#${pages[page] ? page : 'today'}`) a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  });
}

main.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const {action, id} = target.dataset;
  if (pages[action]) { location.hash = action; return; }
  try {
    if (action === 'pet') advancePet(state,id);
    if (action === 'leg') advanceLeg(state,id);
    if (action === 'extend') {
      const stay = state.boarding.find(s => s.id === id);
      const end = id === 'cat-room' ? '2026-09-17' : `2026-09-${String(Number(stay.end.slice(-2))+1).padStart(2,'0')}`;
      extendStay(state,id,end);
      showMessage('已演示延住；真实费用仍需重新确认');
    }
    if (action === 'payment') {
      document.querySelector('#verified').checked = false;
      document.querySelector('#payment-dialog').showModal();
      return;
    }
    persist(); render();
  } catch (error) { showMessage(error.message); }
});

main.addEventListener('change', event => {
  if (event.target.id === 'service-select') {
    const enabled = event.target.value === '寄养';
    document.querySelector('#boarding-field').hidden = !enabled;
    document.querySelector('[name=end]').required = enabled;
  }
  if (event.target.id === 'transport-select') {
    const enabled = event.target.value !== '无需接送';
    const roundtrip = event.target.value === '往返接送';
    document.querySelector('#address-field').hidden = !enabled;
    document.querySelector('[name=address]').required = enabled;
    document.querySelector('#return-field').hidden = !roundtrip;
    document.querySelector('[name=returnAddress]').required = roundtrip;
  }
});

main.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  try {
    if (form.id === 'booking-form') {
      submitBooking(state, { ...Object.fromEntries(new FormData(form)), key: requestKey });
      requestKey = nextKey();
      persist(); render();
      main.querySelector('.success').scrollIntoView({block:'start',behavior:'smooth'});
      return;
    }
    if (form.dataset.care) { saveCare(state,form.dataset.care,new FormData(form).get('note')); persist(); render(); showMessage('已记入本机演示，未向客人发送通知；保存结果见页首'); }
  } catch(error) {
    const inline = document.querySelector('#booking-error');
    if (inline) inline.textContent = error.message; else showMessage(error.message);
  }
});

document.querySelector('#payment-form').addEventListener('submit', event => {
  event.preventDefault();
  try { confirmPayment(state,document.querySelector('#verified').checked); document.querySelector('#payment-dialog').close(); persist(); render(); showMessage('已登记虚构收款；没有发生真实支付'); }
  catch(error) { showMessage(error.message); }
});
document.querySelector('#cancel-payment').addEventListener('click', () => document.querySelector('#payment-dialog').close());
document.querySelector('#phone-toggle').addEventListener('click', event => {
  const active = document.querySelector('#shell').classList.toggle('phone');
  event.target.textContent = active ? '电脑排版' : '手机排版';
  event.target.setAttribute('aria-pressed',String(active));
});
document.querySelector('#reset').addEventListener('click', () => {
  document.querySelector('#reset-dialog').showModal();
});
document.querySelector('#cancel-reset').addEventListener('click', () => document.querySelector('#reset-dialog').close());
document.querySelector('#confirm-reset').addEventListener('click', () => {
  state = createDemo(); requestKey = nextKey();
  document.querySelector('#reset-dialog').close();
  document.querySelector('#payment-dialog').close(); persist(); render(); showMessage('本机虚构数据已重置，另一台手机不受影响');
});
window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY || event.key === null) {
    state = readDemo(storage).state;
    requestKey = nextKey();
    document.querySelector('#payment-dialog').close();
    render();
    storageStatus.textContent = '本浏览器另一标签页更新了演示；未提交表单已重置。不同手机仍不互通。';
  }
});
window.addEventListener('hashchange', () => { render(); main.focus({preventScroll:true}); });
render();
