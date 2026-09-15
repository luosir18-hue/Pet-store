// Fictional, in-memory interaction model only. No production rules or persistence.
export const serviceOptions = ['洗澡护理', '美容修剪', '寄养'];
export function createDemo() {
  return {
    pets: [{ id: 'dog-demo', name: '豆包', kind: '狗 · 柯基', service: '洗澡护理', cents: 9800, status: '已到店' },
      { id: 'cat-demo', name: '糯米', kind: '猫 · 英短', service: '基础护理', cents: 6200, status: '已到店' }],
    paid: false, requests: [],
    boarding: [
      { id: 'cat-room', room: '猫舍 C01', pet: '布丁', start: '2026-09-14', end: '2026-09-16', nextStart: '2026-09-16', care: '' },
      { id: 'dog-room', room: '犬舍 D01', pet: '可乐', start: '2026-09-14', end: '2026-09-15', nextStart: '2026-09-20', care: '' },
    ],
    legs: [
      { id: 'outbound', direction: '接来门店', day: '9月14日', window: '09:00–10:00', person: '接送员甲（演示）', origin: '示例小区北门', destination: '门店', status: '已安排' },
      { id: 'return', direction: '送回主人', day: '9月15日', window: '17:00–18:00', person: '接送员乙（演示）', origin: '门店', destination: '示例小区东门', status: '待安排' },
    ],
  };
}
export function advancePet(state, id) {
  const pet = state.pets.find(p => p.id === id);
  const steps = ['已到店', '服务中', '已完成', '已交还'];
  if (!pet || !steps.includes(pet.status)) throw new Error('找不到示例宠物');
  pet.status = steps[Math.min(steps.indexOf(pet.status) + 1, steps.length - 1)];
}
export function confirmPayment(state, verified) {
  if (!verified) throw new Error('请先勾选演示到账核实');
  if (state.paid) return false;
  state.paid = true;
  return true;
}
export function submitBooking(state, input) {
  if (typeof input.petNames !== 'string' || input.petNames.length > 120) throw new Error('宠物称呼合计不能超过120字');
  if (typeof input.key !== 'string' || !input.key || input.key.length > 100) throw new Error('演示申请标识无效');
  for (const field of ['address','returnAddress']) if (input[field] != null && (typeof input[field] !== 'string' || input[field].length > 100)) throw new Error('示例地点不能超过100字');
  const names = input.petNames.split('、').map(n => n.trim()).filter(Boolean);
  if (!names.length || names.some(n => n.length > 30)) throw new Error('请填写宠物称呼，每只不超过30字');
  if (!serviceOptions.includes(input.service)) throw new Error('请选择服务');
  if (!['无需接送', '单程接来', '往返接送'].includes(input.transport)) throw new Error('请选择接送方式');
  if (!/^2026-09-(1[4-9]|2[0-9]|30)$/.test(input.date)) throw new Error('请选择演示日期：9月14日至30日');
  if (!['上午', '下午'].includes(input.window)) throw new Error('请选择期望时段');
  if (input.service === '寄养' && (!/^2026-09-(1[4-9]|2[0-9]|30)$/.test(input.end) || input.end <= input.date)) throw new Error('寄养离店日期须晚于入住日期，限演示月份');
  if (input.transport !== '无需接送' && !input.address.trim()) throw new Error('选择接送后请填写示例交接地点');
  if (input.transport === '往返接送' && !input.returnAddress.trim()) throw new Error('请填写示例送回地点');
  const existing = state.requests.find(r => r.key === input.key);
  if (existing) return existing;
  if (state.requests.length >= 100) throw new Error('本机演示最多100条申请，请重置后继续测试');
  const request = { id: `DEMO-${state.requests.length + 1}`, key: input.key, names, service: input.service,
    date: input.date, window: input.window, end: input.service === '寄养' ? input.end : null,
    transport: input.transport, address: input.transport === '无需接送' ? null : input.address.trim(),
    returnAddress: input.transport === '往返接送' ? input.returnAddress.trim() : null,
    status: '待老板确认', quote: null };
  state.requests.push(request);
  return request;
}
export function extendStay(state, id, end) {
  const stay = state.boarding.find(s => s.id === id);
  if (!stay) throw new Error('找不到示例入住');
  if (!/^2026-09-\d{2}$/.test(end) || end <= stay.end) throw new Error('新离店日期须晚于当前日期');
  if (end > stay.nextStart) throw new Error('延住冲突：此笼位已有后续预订，原安排保持不变');
  stay.end = end;
}
export function saveCare(state, id, note) {
  if (!note.trim()) throw new Error('请填写实际照护情况，不自动生成“正常”');
  state.boarding.find(s => s.id === id).care = note.trim();
}
export function advanceLeg(state, id) {
  const leg = state.legs.find(l => l.id === id);
  const steps = ['待安排', '已安排', '前往交接', '已接宠', '已送达'];
  if (!leg) throw new Error('找不到示例行程');
  leg.status = steps[Math.min(steps.indexOf(leg.status) + 1, steps.length - 1)];
}
