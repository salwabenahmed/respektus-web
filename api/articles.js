// Fonction serverless qui retourne tous les articles publiés du blog RESPEKTUS.
// Lit la table Airtable "Blog" (même formule que l'app), génère un slug auto-friendly
// depuis le titre, et met en cache 5 minutes pour ne pas spammer Airtable.

const CACHE_TTL_MS = 5 * 60 * 1000;
let _cache = null;
let _cacheAt = 0;

function slugify(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function fetchFromAirtable() {
  const base = process.env.AIRTABLE_BASE_ID;
  const key = process.env.AIRTABLE_API_KEY;
  if (!base || !key) throw new Error('Airtable env missing');
  const url = `https://api.airtable.com/v0/${base}/${encodeURIComponent('Blog')}?filterByFormula=${encodeURIComponent('{Publié}=TRUE()')}&sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=desc`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error('Airtable HTTP ' + r.status);
  const data = await r.json();
  if (!data.records) return [];
  const seenSlugs = new Map();
  return data.records.map(rec => {
    const f = rec.fields || {};
    const photos = f['Photo'];
    const photo = Array.isArray(photos) && photos.length > 0 ? photos[0].url : null;
    let slug = slugify(f['Titre'] || rec.id);
    if (seenSlugs.has(slug)) {
      const n = seenSlugs.get(slug) + 1;
      seenSlugs.set(slug, n);
      slug = `${slug}-${n}`;
    } else {
      seenSlugs.set(slug, 1);
    }
    return {
      id: rec.id,
      slug,
      title: f['Titre'] || '',
      category: f['Categorie'] || 'Aromathérapie',
      intro: f['Intro'] || '',
      content: f['Contenu'] || '',
      tip: f['Conseil'] || '',
      photo,
      date: f['Date'] || '',
    };
  });
}

async function getArticlesCached() {
  const now = Date.now();
  if (_cache && (now - _cacheAt) < CACHE_TTL_MS) return _cache;
  _cache = await fetchFromAirtable();
  _cacheAt = now;
  return _cache;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  try {
    const articles = await getArticlesCached();
    // Filtrage par slug si paramètre fourni
    const slug = req.query?.slug;
    if (slug) {
      const found = articles.find(a => a.slug === slug);
      if (!found) return res.status(404).json({ error: 'Article not found' });
      return res.status(200).json(found);
    }
    return res.status(200).json({ articles });
  } catch (e) {
    console.error('Articles API error:', e);
    return res.status(500).json({ error: 'Server error', message: e.message });
  }
}
