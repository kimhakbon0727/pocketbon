export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  let bodyData = req.body;
  if (typeof bodyData === 'string') {
    try { bodyData = JSON.parse(bodyData); } catch (e) {}
  }

  const { id, time, label } = bodyData || {};
  console.log('--- 알람 등록 요청 수신 ---', { id, time, label });

  if (!id || !time) return res.status(400).json({ error: 'id, time required' });

  // KST 기준으로 delay 계산
  const [h, m] = time.split(':').map(Number);
  const now = Date.now();

  // KST = UTC+9, 현재 KST 시각
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const kstTarget = new Date(kstNow);
  kstTarget.setUTCHours(h, m, 0, 0); // KST 기준 목표 시각

  if (kstTarget.getTime() <= kstNow.getTime()) {
  kstTarget.setUTCDate(kstTarget.getUTCDate() + 1);
}

const delaySeconds = Math.floor((kstTarget.getTime() - now) / 1000); // 👈 이 줄 추가!

console.log(`delay: ${delaySeconds}초 후 발송`);

  const appUrl = process.env.APP_URL || 'https://pocketbon.vercel.app';
  const targetUrl = `${appUrl}/api/send-alarm`;

  try {
    const qstashToken = process.env.QSTASH_TOKEN;
    const qstashRes = await fetch(`https://qstash.upstash.io/v2/publish/${targetUrl}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${qstashToken}`,
        'Content-Type': 'application/json',
        'Upstash-Delay': `${delaySeconds}s`,
      },
      body: JSON.stringify({ id, time, label }),
    });

    const resultText = await qstashRes.text();
    console.log('QStash 응답 상태코드:', qstashRes.status, resultText);

    if (!qstashRes.ok) return res.status(500).json({ error: 'QStash failed', detail: resultText });

    let qstashData = {};
    try { qstashData = JSON.parse(resultText); } catch (e) {}

    const qstashId = qstashData.messageId || qstashData.id;
    if (qstashId) {
      await redisSet(`alarm:${id}`, JSON.stringify({ id, time, label, qstashId }));
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('서버 예외 발생:', error);
    return res.status(500).json({ error: 'Internal Error', message: error.message });
  }
}

async function redisSet(key, value) {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!baseUrl || !token) { console.error('🚨 Redis 환경변수 누락'); return null; }
  const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  try {
    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', key, value])
    });
    const resText = await res.text();
    console.log('Redis 저장 결과:', resText);
    return resText;
  } catch (err) {
    console.error('🚨 Redis 통신 실패:', err);
    return null;
  }
}