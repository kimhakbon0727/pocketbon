// PocketBon Service Worker - 백그라운드 알람 지원
const CACHE_NAME = 'pocketbon-v2';

// ===== 캐시 (기존 기능) =====
self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// ===== 백그라운드 알람 =====
let scheduledAlarms = []; // { id, time, label, timerId }

// 앱(index.html)에서 알람 목록을 받으면 타이머 재설정
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SYNC_ALARMS') {
    // 기존 타이머 전부 클리어
    scheduledAlarms.forEach(a => clearTimeout(a.timerId));
    scheduledAlarms = [];

    // 새 알람 등록
    e.data.alarms.forEach(alarm => {
      scheduleAlarm(alarm);
    });
  }
});

function scheduleAlarm(alarm) {
  const [h, m] = alarm.time.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const diff = target - now;

  const timerId = setTimeout(() => triggerAlarm(alarm), diff);
  scheduledAlarms.push({ ...alarm, timerId });
}

async function triggerAlarm(alarm) {
  // 앱이 열려있으면 앱으로 메시지 전송 (앱이 소리+UI 처리)
  const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (allClients.length > 0) {
    allClients.forEach(client => {
      client.postMessage({ type: 'TRIGGER_ALARM', id: alarm.id });
    });
  }

  // 항상 푸시 알림도 표시 (앱이 닫혀있을 때 이게 주요 알람)
  self.registration.showNotification('⏰ ' + alarm.label, {
    body: alarm.time + ' 알람이에요!',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: 'alarm-' + alarm.id,
    requireInteraction: true,   // 사용자가 닫을 때까지 유지
    vibrate: [300, 100, 300, 100, 300],
    actions: [
      { action: 'stop', title: '알람 끄기' }
    ],
    data: { alarmId: alarm.id, alarmTime: alarm.time, alarmLabel: alarm.label }
  });

  // 내일을 위해 재예약
  const idx = scheduledAlarms.findIndex(a => a.id === alarm.id);
  if (idx !== -1) {
    clearTimeout(scheduledAlarms[idx].timerId);
    scheduledAlarms.splice(idx, 1);
  }
  scheduleAlarm(alarm);
}

// 알림 클릭 → 앱 열기
self.addEventListener('notificationclick', e => {
  e.notification.close();

  if (e.action === 'stop') {
    // "알람 끄기" 액션: 아무 추가 동작 없음 (알림만 닫힘)
    return;
  }

  // 알림 탭하면 앱 포커스 또는 열기
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      if (clients.length > 0) {
        return clients[0].focus();
      }
      return self.clients.openWindow('./');
    })
  );
});
