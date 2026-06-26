// api/delete-alarm.js
// 알람 취소: QStash 메시지 삭제 + Redis에서 제거

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });

  // Redis에서 알람 정보 가져오기
  const alarmJson = await redisGet(`alarm:${id}`);
  if (alarmJson) {
    const alarm = JSON.parse(alarmJson);
    // QStash 메시지 삭제
    if (alarm.qstashId) {
      await fetch(`https://qstash.upstash.io/v2/messages/${alarm.qstashId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${process.env.QSTASH_TOKEN}` },
      });
    }
    // Redis에서 삭제
    await redisDel(`alarm:${id}`);
  }

  return res.status(200).json({ ok: true });
}

async function redisGet(key) {
  const url = `${process.env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
  });
  const data = await res.json();
  return data.result;
}

async function redisDel(key) {
  const url = `${process.env.UPSTASH_REDIS_REST_URL}/del/${encodeURIComponent(key)}`;
  await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
  });
}
