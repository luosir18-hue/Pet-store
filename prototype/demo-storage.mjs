import { createDemo, submitBooking, extendStay } from './model.mjs';
export const STORAGE_KEY = 'pet-store:phone-demo:v1';

// Reconstruct from known fixtures; never hydrate arbitrary names/prices/HTML.
export function decodeSnapshot(text) {
  if (typeof text !== 'string' || text.length > 100000) throw new Error('invalid snapshot');
  const saved = JSON.parse(text);
  if (saved.version !== 1) throw new Error('unsupported snapshot');
  const raw = saved.state, state = createDemo();
  if (!raw || typeof raw.paid !== 'boolean' || !Array.isArray(raw.requests) || raw.requests.length > 100) throw new Error('invalid state');
  for (const [field, statuses] of [['pets',['已到店','服务中','已完成','已交还']], ['legs',['待安排','已安排','前往交接','已接宠','已送达']]]) {
    if (!Array.isArray(raw[field]) || raw[field].length !== state[field].length) throw new Error('invalid list');
    state[field].forEach((item, i) => {
      if (raw[field][i].id !== item.id || !statuses.includes(raw[field][i].status)) throw new Error('invalid status');
      item.status = raw[field][i].status;
    });
  }
  if (!Array.isArray(raw.boarding) || raw.boarding.length !== 2) throw new Error('invalid boarding');
  state.boarding.forEach((stay, i) => {
    const item = raw.boarding[i];
    if (item.id !== stay.id || typeof item.care !== 'string' || item.care.length > 500) throw new Error('invalid care');
    if (item.end !== stay.end) extendStay(state, stay.id, item.end);
    stay.care = item.care;
  });
  for (const item of raw.requests) {
    if (!Array.isArray(item.names) || item.names.some(n => typeof n !== 'string') || item.names.join('、').length > 120 ||
      typeof item.key !== 'string' || !item.key || item.key.length > 100 || state.requests.some(r => r.key === item.key)) throw new Error('invalid request');
    for (const key of ['address','returnAddress']) if (item[key] !== null && (typeof item[key] !== 'string' || item[key].length > 100)) throw new Error('invalid address');
    submitBooking(state, { ...item, petNames:item.names.join('、'), address:item.address ?? '', returnAddress:item.returnAddress ?? '' });
  }
  state.paid = raw.paid;
  return state;
}
export function readDemo(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return { state: raw === null ? createDemo() : decodeSnapshot(raw), message: '演示进度仅保存在本浏览器；两台手机不互通。' };
  } catch {
    return { state:createDemo(), message:'本地记录不可读取或版本不兼容，已显示初始演示；不支持真实账目保管。' };
  }
}
export function writeDemo(storage, state) {
  try {
    const text = JSON.stringify({version:1,state});
    decodeSnapshot(text);
    storage.setItem(STORAGE_KEY, text);
    return true;
  } catch { return false; }
}
