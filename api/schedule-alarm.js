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

  const appUrl = process.env.APP_URL || 'https://pocketbon.vercel.app';
  const targetUrl = `${appUrl}/api/send-alarm`;

  console.log('Scheduling alarm:', { id, time, label, delaySeconds, targetUrl });

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
  console.log('QStash response:', qstashRes.status, resultText);

  if (!qstashRes.ok) {
    return res.status(500).json({ error: 'QStash failed', detail: resultText });
  }

  return res.status(200).json({ ok: true });
}
