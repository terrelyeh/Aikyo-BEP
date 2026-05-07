const crypto = require('crypto');

const PW_HASH = '04791dc6eea8faa8850cafa65b34829f067549c15ca9b38db1cfe8235ac94b09';

function isPosNum(v, max = 1e9) {
  return typeof v === 'number' && isFinite(v) && v >= 0 && v <= max;
}

function validateConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return 'Config must be an object';
  if (!Array.isArray(cfg.items)) return 'items must be an array';
  if (cfg.items.length < 1 || cfg.items.length > 5) return 'items length must be 1-5';
  for (const it of cfg.items) {
    if (typeof it.name !== 'string' || !it.name.trim()) return 'Invalid item name';
    if (!isPosNum(it.price, 10000) || it.price <= 0) return 'Invalid item price';
    if (!isPosNum(it.gm, 100)) return 'Invalid item gm';
  }
  const d = cfg.defaults;
  if (!d || typeof d !== 'object') return 'defaults missing';
  const o = d.operations;
  if (!o) return 'operations missing';
  if (!isPosNum(o.days, 31)   || o.days <= 0)  return 'Invalid days';
  if (!isPosNum(o.hours, 24)  || o.hours <= 0) return 'Invalid hours';
  if (!isPosNum(o.ptPct, 100))                 return 'Invalid ptPct';
  if (!isPosNum(o.ptWage, 2000))               return 'Invalid ptWage';
  if (!isPosNum(o.ptCount, 50))                return 'Invalid ptCount';
  const f = d.fixedCosts;
  if (!f) return 'fixedCosts missing';
  if (!isPosNum(f.rent, 1e6))         return 'Invalid rent';
  if (!isPosNum(f.utilities, 1e6))    return 'Invalid utilities';
  if (!isPosNum(f.depreciation, 1e6)) return 'Invalid depreciation';
  if (!isPosNum(f.fulltime, 1e7))     return 'Invalid fulltime';
  if (typeof f.depreciationEnabled !== 'boolean') return 'Invalid depreciationEnabled';
  if (d.b2b !== undefined) {
    if (typeof d.b2b !== 'object' || d.b2b === null) return 'Invalid b2b';
    if (!isPosNum(d.b2b.rebate, 100)) return 'Invalid b2b.rebate';
  }
  return null;
}

function cleanConfig(cfg) {
  return {
    items: cfg.items.map(it => ({
      name: String(it.name).trim(),
      price: Math.round(Number(it.price)),
      gm: Math.round(Number(it.gm))
    })),
    defaults: {
      operations: {
        days:    Math.round(Number(cfg.defaults.operations.days)),
        hours:   Math.round(Number(cfg.defaults.operations.hours)),
        ptPct:   Math.round(Number(cfg.defaults.operations.ptPct)),
        ptWage:  Math.round(Number(cfg.defaults.operations.ptWage)),
        ptCount: Math.round(Number(cfg.defaults.operations.ptCount))
      },
      fixedCosts: {
        rent:                Math.round(Number(cfg.defaults.fixedCosts.rent)),
        utilities:           Math.round(Number(cfg.defaults.fixedCosts.utilities)),
        depreciation:        Math.round(Number(cfg.defaults.fixedCosts.depreciation)),
        depreciationEnabled: !!cfg.defaults.fixedCosts.depreciationEnabled,
        fulltime:            Math.round(Number(cfg.defaults.fixedCosts.fulltime))
      },
      b2b: cfg.defaults.b2b ? {
        rebate: Math.round(Number(cfg.defaults.b2b.rebate))
      } : { rebate: 15 }
    }
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { password, config } = body;

  if (!password || !config) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (hash !== PW_HASH) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const err = validateConfig(config);
  if (err) return res.status(400).json({ error: err });

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    return res.status(500).json({ error: 'Server missing GITHUB_TOKEN or GITHUB_REPO' });
  }

  const path = 'config.json';
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
    const detail = await getRes.text();
    console.error('[save-config] GitHub GET failed', getRes.status, detail);
    return res.status(500).json({
      error: `Failed to fetch current file (${getRes.status})`,
      status: getRes.status,
      detail
    });
  }

  const cleaned = cleanConfig(config);
  const newContent = JSON.stringify(cleaned, null, 2) + '\n';
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
      message: 'chore: update config.json',
      content: b64,
      sha,
      branch: 'main'
    })
  });

  if (!putRes.ok) {
    const detail = await putRes.text();
    console.error('[save-config] GitHub PUT failed', putRes.status, detail);
    return res.status(500).json({
      error: `GitHub API failed (${putRes.status})`,
      status: putRes.status,
      detail
    });
  }

  const result = await putRes.json();
  return res.status(200).json({
    ok: true,
    commit: result.commit && result.commit.sha,
    config: cleaned
  });
};
