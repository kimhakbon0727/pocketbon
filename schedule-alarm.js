// api/schedule-alarm.js
// 알람을 QStash에 예약 → 지정 시각에 /api/send-alarm 호출

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { id, time, label } = req.body;
  if (!id || !time) return res.status(400).json({ error: 'id, time required' });

  // 알람 시각 계산 (오늘 또는 내일)
  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  // 한국 시간(UTC+9) 기준으로 타겟 시각 계산
  const target = new Date();
  target.setUTCHours(h - 9, m, 0, 0); // KST → UTC 변환
  if (target <= now) target.setUTCDate(target.getUTCDate() + 1);

  const delaySeconds = Math.floor((target - now) / 1000);
  if (delaySeconds <= 0) return res.status(400).json({ error: 'time already passed' });

  const appUrl = process.env.APP_URL || `https://${req.headers.host}`;

  // QStash에 지연 메시지 예약
  const qstashRes = await fetch('https://qstash.upstash.io/v2/publish/schedule', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
      'Content-Type': 'application/json',
      'Upstash-Delay': `${delaySeconds}s`,
      'Upstash-Deduplication-Id': `alarm-${id}`, // 중복 방지
    },
    body: JSON.stringify({
      url: `${appUrl}/api/send-alarm`,
      body: JSON.stringify({ id, time, label }),
    })
  });

  if (!qstashRes.ok) {
    const err = await qstashRes.text();
    console.error('QStash error:', err);
    return res.status(500).json({ error: 'QStash scheduling failed', detail: err });
  }

  const result = await qstashRes.json();

  // Redis에 알람 정보 저장 (취소용)
  await redisSet(`alarm:${id}`, JSON.stringify({ id, time, label, qstashId: result.messageId }));

  return res.status(200).json({ ok: true, messageId: result.messageId, fireAt: target.toISOString() });
}

async function redisSet(key, value) {
  const url = `${process.env.UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}`;
  await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
  });
}
