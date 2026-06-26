// api/send-alarm.js
import { GoogleAuth } from 'google-auth-library';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id, time, label } = req.body;

  try {
    const fcmToken = await redisGet('pocketbon:fcmtoken');
    if (!fcmToken) {
      console.error('FCM token not found in Redis');
      return res.status(200).json({ ok: false, reason: 'no fcm token' });
    }

    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    const auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
    const accessToken = await auth.getAccessToken();
    const projectId = serviceAccount.project_id;

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
      console.error('FCM error:', fcmText);
      return res.status(500).json({ error: 'FCM send failed', detail: fcmText });
    }

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