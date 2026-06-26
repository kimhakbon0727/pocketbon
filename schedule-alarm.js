export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // POST 메서드만 허용
  if (req.method !== 'POST') return res.status(405).end();

  // 안전하게 body가 비어있거나 객체가 아닐 때를 대비한 안전장치
  let bodyData = req.body;
  if (typeof bodyData === 'string') {
    try {
      bodyData = JSON.parse(bodyData);
    } catch (e) {
      console.error('JSON Parse 에러:', e);
    }
  }

  const { id, time, label } = bodyData || {};
  
  // Vercel 로그에서 데이터가 제대로 들어오는지 명확하게 식별하기 위한 콘솔 출력
  console.log('--- 알람 등록 요청 발생 ---');
  console.log('수신된 데이터:', { id, time, label });

  // 필수값 검증
  if (!id || !time) {
    console.error('필수 데이터 누락:', { id, time });
    return res.status(400).json({ 
      error: 'id, time required', 
      received: { id, time, label } 
    });
  }

  // 시간 파싱 및 지연 시간(초) 계산
  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  
  // 선택한 시간이 이미 지났다면 다음날로 설정
  if (target <= now) target.setDate(target.getDate() + 1);
  const delaySeconds = Math.floor((target - now) / 1000);

  const appUrl = process.env.APP_URL || 'https://pocketbon.vercel.app';
  const targetUrl = `${appUrl}/api/send-alarm`;

  console.log('QStash 예약 정보:', { id, time, label, delaySeconds, targetUrl });

  try {
    // QStash 스케줄러 등록 요청
    const qstashRes = await fetch(`https://qstash.upstash.io/v2/publish/${encodeURIComponent(targetUrl)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
        'Content-Type': 'application/json',
        'Upstash-Delay': `${delaySeconds}s`,
      },
      body: JSON.stringify({ id, time, label }),
    });

    const resultText = await qstashRes.text();
    console.log('QStash 응답 상태코드:', qstashRes.status);
    console.log('QStash 응답 본문:', resultText);

    if (!qstashRes.ok) {
      return res.status(500).json({ error: 'QStash failed', detail: resultText });
    }

    // 다음 알람 삭제 요청(delete-alarm) 시 취소할 수 있도록 필요하다면 Redis 저장을 이곳에 연동할 수 있습니다.
    // 현재 구조에서는 성공 상태(200)와 함께 결과를 반환합니다.
    return res.status(200).json({ ok: true, detail: resultText });

  } catch (error) {
    console.error('QStash 통신 중 예외 발생:', error);
    return res.status(500).json({ error: 'Internal Fetch Error', message: error.message });
  }
}