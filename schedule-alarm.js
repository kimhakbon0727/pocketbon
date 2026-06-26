export default async function handler(req, res) {
  // 1. CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // 2. 안전하게 데이터 파싱
  let bodyData = req.body;
  if (typeof bodyData === 'string') {
    try {
      bodyData = JSON.parse(bodyData);
    } catch (e) {
      console.error('JSON 파싱 에러:', e);
    }
  }

  const { id, time, label } = bodyData || {};
  console.log('--- 알람 등록 요청 수신 ---', { id, time, label });

  if (!id || !time) {
    return res.status(400).json({ error: 'id, time required' });
  }

  // 3. 지연 시간(초) 계산
  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  
  if (target <= now) target.setDate(target.getDate() + 1);
  const delaySeconds = Math.floor((target - now) / 1000);

  const appUrl = process.env.APP_URL || 'https://pocketbon.vercel.app';
  const targetUrl = `${appUrl}/api/send-alarm`;

  try {
    // 4. QStash 스케줄러 등록 요청 (Bear 토큰 확인 필수)
    const qstashToken = process.env.QSTASH_TOKEN;
    const qstashRes = await fetch(`https://qstash.upstash.io/v2/publish/${encodeURIComponent(targetUrl)}`, {
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

    if (!qstashRes.ok) {
      // 401 Unauthorized인 경우 로그에 더 명시적으로 경고를 찍어줍니다.
      if (qstashRes.status === 401) {
        console.error('🚨 QStash 인증 실패! Vercel의 QSTASH_TOKEN 값을 확인하세요.');
      }
      return res.status(500).json({ error: 'QStash failed', detail: resultText });
    }

    // 5. 알람 삭제(delete-alarm)에 활용할 수 있도록 Redis에 스케줄 정보 기록 복구
    let qstashData = {};
    try {
      qstashData = JSON.parse(resultText);
    } catch (e) {}

    const qstashId = qstashData.messageId || qstashData.id;
    if (qstashId) {
      await redisSet(`alarm:${id}`, JSON.stringify({ id, time, label, qstashId }));
      console.log(`Redis 저장 완료 (alarm:${id})`);
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('서버 예외 발생:', error);
    return res.status(500).json({ error: 'Internal Error', message: error.message });
  }
}

// === Redis 헬퍼 함수 복구 ===
async function redisSet(key, value) {
  const url = `${process.env.UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
    });
    return await res.text();
  } catch (err) {
    console.error('Redis 저장 실패:', err);
  }
}