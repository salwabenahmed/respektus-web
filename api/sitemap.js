// Sitemap dynamique pour Google. Inclut les pages statiques + tous les articles
// du blog (lus depuis Airtable). Vercel sert /sitemap.xml via rewrite.

const CACHE_TTL_MS = 15 * 60 * 1000;
let _cache = null;
let _cacheAt = 0;

function slugify(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function escapeXml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function fetchArticles() {
  const base = process.env.AIRTABLE_BASE_ID;
  const key = process.env.AIRTABLE_API_KEY;
  if (!base || !key) return [];
  const url = `https://api.airtable.com/v0/${base}/${encodeURIComponent('Blog')}?filterByFormula=${encodeURIComponent('{Publié}=TRUE()')}&sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=desc`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) return [];
  const data = await r.json();
  if (!data.records) return [];
  const seen = new Map();
  return data.records.map(rec => {
    const f = rec.fields || {};
    let slug = slugify(f['Titre'] || rec.id);
    if (seen.has(slug)) { const n = seen.get(slug) + 1; seen.set(slug, n); slug = `${slug}-${n}`; }
    else { seen.set(slug, 1); }
    return { slug, date: f['Date'] || new Date().toISOString() };
  });
}

async function getCached() {
  const now = Date.now();
  if (_cache && (now - _cacheAt) < CACHE_TTL_MS) return _cache;
  _cache = await fetchArticles();
  _cacheAt = now;
  return _cache;
}

export default async function handler(req, res) {
  const HOST = 'https://www.respektus.com';
  const today = new Date().toISOString().split('T')[0];

  const staticPages = [
    { loc: `${HOST}/`, priority: '1.0', changefreq: 'weekly', lastmod: today },
    { loc: `${HOST}/blog`, priority: '0.9', changefreq: 'daily', lastmod: today },
    { loc: `${HOST}/parrainage`, priority: '0.7', changefreq: 'monthly', lastmod: today },
    { loc: `${HOST}/mentions-legales`, priority: '0.3', changefreq: 'yearly', lastmod: today },
    { loc: `${HOST}/cgv`, priority: '0.3', changefreq: 'yearly', lastmod: today },
    { loc: `${HOST}/confidentialite`, priority: '0.3', changefreq: 'yearly', lastmod: today },
  ];

  let articles = [];
  try { articles = await getCached(); } catch (e) { console.error('sitemap articles err:', e); }

  const articleUrls = articles.map(a => ({
    loc: `${HOST}/blog/${a.slug}`,
    priority: '0.8',
    changefreq: 'monthly',
    lastmod: (a.date || today).split('T')[0],
  }));

  const all = [...staticPages, ...articleUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map(u => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
  return res.status(200).send(xml);
}
