const crypto = require('crypto');

const PW_HASH = '04791dc6eea8faa8850cafa65b34829f067549c15ca9b38db1cfe8235ac94b09';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { password, items } = body;

  if (!password || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (hash !== PW_HASH) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (items.length < 1 || items.length > 5) {
    return res.status(400).json({ error: 'Items count must be 1-5' });
  }
  for (const it of items) {
    if (typeof it.name !== 'string' || !it.name.trim()) {
      return res.status(400).json({ error: 'Invalid item name' });
    }
    if (typeof it.price !== 'number' || it.price <= 0 || it.price > 10000) {
      return res.status(400).json({ error: 'Invalid item price' });
    }
    if (typeof it.gm !== 'number' || it.gm < 0 || it.gm > 100) {
      return res.status(400).json({ error: 'Invalid item gm' });
    }
  }

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    return res.status(500).json({ error: 'Server missing GITHUB_TOKEN or GITHUB_REPO' });
  }

  const path = 'items.json';
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;

  let sha;
  const getRes = await fetch(`${apiUrl}?ref=main`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'aikyo-bep-cms'
    }
  });
  if (getRes.ok) {
    const data = await getRes.json();
    sha = data.sha;
  } else if (getRes.status !== 404) {
    return res.status(500).json({ error: 'Failed to fetch current file', detail: await getRes.text() });
  }

  const cleanItems = items.map(it => ({
    name: String(it.name).trim(),
    price: Math.round(Number(it.price)),
    gm: Math.round(Number(it.gm))
  }));
  const newContent = JSON.stringify({ items: cleanItems }, null, 2) + '\n';
  const b64 = Buffer.from(newContent, 'utf-8').toString('base64');

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'aikyo-bep-cms'
    },
    body: JSON.stringify({
      message: `chore: update items.json (${cleanItems.length} items)`,
      content: b64,
      sha,
      branch: 'main'
    })
  });

  if (!putRes.ok) {
    const detail = await putRes.text();
    return res.status(500).json({ error: 'GitHub API failed', detail });
  }

  const result = await putRes.json();
  return res.status(200).json({
    ok: true,
    commit: result.commit && result.commit.sha,
    items: cleanItems
  });
};
