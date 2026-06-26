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
    // 4. QStash 스케줄러 등록 요청
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

    if (!qstashRes.ok) {
      return res.status(500).json({ error: 'QStash failed', detail: resultText });
    }

    // 5. 알람 취소를 위한 Redis 세팅
    let qstashData = {};
    try {
      qstashData = JSON.parse(resultText);
    } catch (e) {}

    const qstashId = qstashData.messageId || qstashData.id;
    if (qstashId) {
      // 💡 오류 차단을 위해 에러 핸들링 및 POST 구조로 안전하게 변경된 함수 호출
      await redisSet(`alarm:${id}`, JSON.stringify({ id, time, label, qstashId }));
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('서버 예외 발생:', error);
    return res.status(500).json({ error: 'Internal Error', message: error.message });
  }
}

// === 안전하게 개선된 Redis SET 함수 ===
async function redisSet(key, value) {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!baseUrl || !token) {
    console.error('🚨 Redis 환경변수(URL 또는 TOKEN)가 누락되었습니다.');
    return null;
  }

  // URL 뒤에 슬래시가 붙어있는지 확인하여 깔끔한 엔드포인트 생성
  const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  try {
    // GET방식 대신 깨질 염려가 없는 안전한 POST 바디 방식으로 호출
    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(['SET', key, value])
    });
    
    const resText = await res.text();
    console.log('Redis 저장 결과:', resText);
    return resText;
  } catch (err) {
    console.error('🚨 Redis 통신 완전 실패:', err);
    return null;
  }
}