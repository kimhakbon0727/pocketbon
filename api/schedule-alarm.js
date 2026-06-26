export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { id, time, label } = req.body;
  if (!id || !time) return res.status(400).json({ error: 'id, time required' });

  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const delaySeconds = Math.floor((target - now) / 1000);

  const appUrl = process.env.APP_URL;

  const qstashRes = await fetch('https://qstash.upstash.io/v2/publish/schedule', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
      'Content-Type': 'application/json',
      'Upstash-Delay': `${delaySeconds}s`,
      'Upstash-Deduplication-Id': `alarm-${id}`,
    },
    body: JSON.stringify({
      url: `${appUrl}/api/send-alarm`,
      body: JSON.stringify({ id, time, label }),
    })
  });

  if (!qstashRes.ok) {
    const err = await qstashRes.text();
    return res.status(500).json({ error: 'QStash failed', detail: err });
  }

  const result = await qstashRes.json();
  return res.status(200).json({ ok: true, messageId: result.messageId });
}
