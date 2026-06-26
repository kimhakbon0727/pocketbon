// api/send-alarm.js
// QStash가 알람 시각에 이 API를 호출 → FCM으로 푸시 알림 전송

import { GoogleAuth } from 'google-auth-library';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id, time, label } = req.body;

  try {
    // Redis에서 FCM 토큰 가져오기
    const fcmToken = await redisGet('pocketbon:fcmtoken');
    if (!fcmToken) {
      console.error('FCM token not found in Redis');
      return res.status(200).json({ ok: false, reason: 'no fcm token' });
    }

    // Firebase Admin SDK 인증 (서비스 계정 JSON → access token)
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    const auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
    const accessToken = await auth.getAccessToken();

    const projectId = serviceAccount.project_id;

    // FCM V1 API로 푸시 알림 전송
    const fcmRes = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: {
              title: `⏰ ${label}`,
              body: `${time} 알람이에요!`,
            },
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                channel_id: 'alarm_channel',
                //vibrate_timings_millis: ['0', '500', '200', '500'],
                //priority: 'high',
                visibility: 'PUBLIC',
              },
            },
            data: {
              alarmId: String(id),
              alarmTime: time,
              alarmLabel: label,
              type: 'ALARM',
            },
          },
        }),
      }
    );




    const fcmText = await fcmRes.text();
    console.log('FCM 응답:', fcmRes.status, fcmText);



    
    if (!fcmRes.ok) {
      const err = await fcmRes.text();
      console.error('FCM error:', fcmText); 
      return res.status(500).json({ error: 'FCM send failed', detail: fcmText });
    }

    // 매일 반복 알람: 다음날 재예약
    const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
    
    //try {

    //await fetch(`${appUrl}/api/schedule-alarm`, {
    //  method: 'POST',
    //  headers: { 'Content-Type': 'application/json' },
    //  body: JSON.stringify({ id: Date.now(), time, label }), // 새 id로 재예약
    //});

    //}
    //catch(e) {
    //  console.error('재예약 실패:', e);
    //}


    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('send-alarm error:', e);
    return res.status(500).json({ error: e.message });
  }
}

async function redisGet(key) {
  const url = `${process.env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
  });
  const data = await res.json();
  return data.result;
}
