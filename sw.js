// PocketBon Service Worker - 안드로이드 백그라운드 알람
const CACHE_NAME = 'pocketbon-v3';
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
// SW는 슬립될 수 있으므로 setTimeout 대신
// 앱에서 주기적으로 SW를 깨워서 체크하는 하이브리드 방식 사용

let alarmLoopTimer = null;

function startAlarmLoop() {
  if (alarmLoopTimer) clearTimeout(alarmLoopTimer);
  checkAlarms();
}

async function checkAlarms() {
  try {
    // IndexedDB 대신 SW 내부 캐시 스토리지에 알람 저장
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

      // 현재 분이 알람 분과 일치하고, 아직 오늘 발동 안 했으면
      const todayKey = `fired-${alarm.id}-${now.toDateString()}`;
      const firedRes = await cache.match(todayKey);
      if (nowMin === alarmMin && !firedRes) {
        // 발동 표시 저장 (중복 방지)
        await cache.put(todayKey, new Response('1'));
        await triggerAlarm(alarm);
      }

      // 어제 발동 기록 정리 (어제 날짜 키 삭제)
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
  // 다음 체크는 30초 후
  // SW가 슬립되면 이 타이머도 멈추지만,
  // 앱에서 매분 keepAlive 메시지를 보내 SW를 깨움
  alarmLoopTimer = setTimeout(checkAlarms, CHECK_INTERVAL_MS);
}

// ===== 앱 → SW 메시지 처리 =====
self.addEventListener('message', async e => {
  if (!e.data) return;

  // 알람 목록 동기화
  if (e.data.type === 'SYNC_ALARMS') {
    const cache = await caches.open('pocketbon-alarms-data');
    await cache.put('alarms', new Response(JSON.stringify(e.data.alarms)));
    // 즉시 체크
    if (alarmLoopTimer) clearTimeout(alarmLoopTimer);
    checkAlarms();
  }

  // 앱이 keepAlive 핑을 보내면 SW가 깨어남 (루프 재시작)
  if (e.data.type === 'KEEP_ALIVE') {
    if (!alarmLoopTimer) checkAlarms();
  }
});

// ===== 알람 발동 =====
async function triggerAlarm(alarm) {
  // 열린 앱 창에 메시지 전송
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(c => c.postMessage({ type: 'TRIGGER_ALARM', id: alarm.id }));

  // 시스템 푸시 알림 (앱 닫혀있을 때 핵심)
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
