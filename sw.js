// PocketBon Service Worker - 안드로이드 백그라운드 알람
const CACHE_NAME = 'pocketbon-v5';
const CHECK_INTERVAL_MS = 30000; // 30초마다 알람 체크

// ===== 설치 / 활성화 =====
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => startAlarmLoop())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

// ===== 알람 루프 (핵심) =====
let alarmLoopTimer = null;

function startAlarmLoop() {
  if (alarmLoopTimer) clearTimeout(alarmLoopTimer);
  checkAlarms();
}

async function checkAlarms() {
  try {
    const cache = await caches.open('pocketbon-alarms-data');
    const res = await cache.match('alarms');
    if (!res) return scheduleNext();

    const alarms = await res.json();
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    for (const alarm of alarms) {
      if (!alarm.active) continue;
      const [h, m] = alarm.time.split(':').map(Number);
      const alarmMin = h * 60 + m;

      const todayKey = `fired-${alarm.id}-${now.toDateString()}`;
      const firedRes = await cache.match(todayKey);
      if (nowMin === alarmMin && !firedRes) {
        await cache.put(todayKey, new Response('1'));
        await triggerAlarm(alarm);
      }

      const yesterday = new Date(now - 86400000);
      const oldKey = `fired-${alarm.id}-${yesterday.toDateString()}`;
      cache.delete(oldKey);
    }
  } catch(e) {
    console.error('[SW] checkAlarms error:', e);
  }

  scheduleNext();
}

function scheduleNext() {
  alarmLoopTimer = setTimeout(checkAlarms, CHECK_INTERVAL_MS);
}

// ===== 앱 → SW 메시지 처리 =====
self.addEventListener('message', async e => {
  if (!e.data) return;

  if (e.data.type === 'SYNC_ALARMS') {
    const cache = await caches.open('pocketbon-alarms-data');
    await cache.put('alarms', new Response(JSON.stringify(e.data.alarms)));
    if (alarmLoopTimer) clearTimeout(alarmLoopTimer);
    checkAlarms();
  }

  if (e.data.type === 'KEEP_ALIVE') {
    if (!alarmLoopTimer) checkAlarms();
  }
});

// ===== 알람 발동 =====
async function triggerAlarm(alarm) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(c => c.postMessage({ type: 'TRIGGER_ALARM', id: alarm.id }));

  await self.registration.showNotification('⏰ ' + alarm.label, {
    body: alarm.time + ' 알람이에요! 탭해서 끄기',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: 'alarm-' + alarm.id,
    requireInteraction: true,
    vibrate: [500, 200, 500, 200, 500],
    silent: false,
    actions: [{ action: 'stop', title: '⏹ 알람 끄기' }],
    data: { alarmId: alarm.id }
  });
}

// ===== 알림 클릭 =====
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow('./');
    })
  );
});
