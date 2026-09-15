const status = document.querySelector('#offline-status');
const updateButton = document.querySelector('#apply-update');
let cached = false;
function showStatus() {
  status.textContent = cached
    ? `页面缓存已就绪 · ${navigator.onLine ? '可尝试飞行模式重新打开' : '当前离线提示'} · 缓存可能被系统清理，请勿记录真实业务`
    : '离线缓存尚未就绪，请先保持联网。';
}
async function setup() {
  if (!window.isSecureContext || !('serviceWorker' in navigator)) {
    status.textContent = '当前环境不支持离线缓存，请用系统浏览器打开 HTTPS 链接；仍可在线试页面。';
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register('./sw.js', {scope:'./', updateViaCache:'none'});
    const showUpdate = () => { updateButton.hidden = !(navigator.serviceWorker.controller && registration.waiting); };
    showUpdate();
    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange', showUpdate);
    });
    let applyingUpdate = false;
    updateButton.addEventListener('click', () => {
      if (!registration.waiting) return;
      applyingUpdate = true;
      registration.waiting.postMessage({type:'ACTIVATE_DEMO_UPDATE'});
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      showUpdate();
      if (applyingUpdate) location.reload();
    });
    await navigator.serviceWorker.ready;
    showUpdate();
    cached = true;
    showStatus();
    window.addEventListener('online',showStatus);
    window.addEventListener('offline',showStatus);
  } catch {
    status.textContent = '离线缓存失败，当前只能在线试用。请检查 HTTPS、浏览器限制和文件是否完整。';
  }
}
setup();
