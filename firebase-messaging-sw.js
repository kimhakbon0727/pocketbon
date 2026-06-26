// firebase-messaging-sw.js
// FCM 백그라운드 푸시 알림 수신 전용 Service Worker
// 반드시 루트(/)에 위치해야 함

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyArEEaF-fK6ZPq7mjVdQgDWqCn_zDchsKQ",
  authDomain: "pocketbon.firebaseapp.com",
  projectId: "pocketbon",
  storageBucket: "pocketbon.firebasestorage.app",
  messagingSenderId: "317305023515",
  appId: "1:317305023515:web:79fa812518da5d2d665cbe",
});

const messaging = firebase.messaging();

// 앱이 백그라운드/종료 상태일 때 푸시 수신
messaging.onBackgroundMessage(payload => {
  console.log('[FCM SW] 백그라운드 메시지 수신:', payload);

  const { title, body } = payload.notification || {};
  const data = payload.data || {};

  self.registration.showNotification(title || '⏰ 알람', {
    body: body || '알람 시간이에요!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'alarm-' + (data.alarmId || Date.now()),
    requireInteraction: true,
    vibrate: [500, 200, 500, 200, 500],
    data: data,
    actions: [
      { action: 'stop', title: '⏹ 알람 끄기' }
    ]
  });
});

// 알림 클릭 → 앱 열기
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) return clientList[0].focus();
      return clients.openWindow('/');
    })
  );
});
