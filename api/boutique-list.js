// Page SSR de la boutique : /boutique
// Rendue par Vercel rewrites (vercel.json : /boutique → /api/boutique-list)
// Lit en direct la table "Produits" du même Airtable que l'app RESPEKTUS, donc toujours
// à jour automatiquement — aucun contenu à dupliquer manuellement.
// Design volontairement proche de l'app mobile (mêmes couleurs, mêmes messages), en plus
// grand pour l'écran large : gros bandeau, grandes photos, gros boutons.

const CACHE_TTL_MS = 60 * 1000;
let _cache = null;
let _cacheAt = 0;
const FREE_SHIPPING_THRESHOLD = 35;

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function fetchProducts() {
  const now = Date.now();
  if (_cache && (now - _cacheAt) < CACHE_TTL_MS) return _cache;
  const base = process.env.AIRTABLE_BASE_ID;
  const key = process.env.AIRTABLE_API_KEY;
  const url = `https://api.airtable.com/v0/${base}/${encodeURIComponent('Produits')}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  const data = await r.json();
  if (!data.records) return [];
  _cache = data.records.map(rec => {
    const f = rec.fields || {};
    const attachments = Array.isArray(f['Photo']) ? f['Photo'] : [];
    const photo = attachments.find(a => !String(a.type || '').startsWith('video/'))?.url || null;
    return {
      id: rec.id,
      name: f['Nom'] || '',
      description: f['Description'] || '',
      price: Number(f['Prix']) || 0,
      originalPrice: f['Prix original'] ? Number(f['Prix original']) || null : null,
      category: f['Categorie'] || '',
      badge: f['Badge'] || null,
      inStock: !!f['Stock'],
      photo,
      deliveryEstimate: f['Delai livraison'] || '',
    };
  });
  _cacheAt = now;
  return _cache;
}

export default async function handler(req, res) {
  let products = [];
  try {
    products = await fetchProducts();
  } catch (e) {
    console.error('boutique-list error:', e);
  }

  const cards = products.map(p => `
    <div class="card">
      <div class="card-media">
        ${p.photo ? `<img src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy">` : `<div class="no-photo"></div>`}
        ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}
      </div>
      <div class="card-body">
        <h3>${esc(p.name)}</h3>
        <div class="price-row">
          <span class="price">${p.price.toFixed(2)} €</span>
          ${p.originalPrice ? `<span class="original-price">${p.originalPrice.toFixed(2)} €</span>` : ''}
        </div>
        ${!p.inStock ? '<p class="out-of-stock">Rupture de stock</p>' : '<p class="in-stock">Livraison offerte dès 35€</p>'}
        ${p.deliveryEstimate ? `<p class="delivery">Livraison estimée : ${esc(p.deliveryEstimate)}</p>` : ''}
      </div>
    </div>`).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Boutique — Accessoires bien-être naturel — RESPEKTUS®</title>
  <meta name="description" content="La boutique RESPEKTUS® : accessoires et outils de rituel bien-être naturel — diffuseurs d'huiles essentielles, gua sha, rouleaux de jade, brumisateurs et accessoires de soin. Livraison offerte dès 35€ d'achat.">
  <link rel="canonical" href="https://www.respektus.com/boutique">
  <meta property="og:title" content="Boutique RESPEKTUS® — Accessoires bien-être naturel">
  <meta property="og:description" content="Diffuseurs, gua sha, rouleaux de jade et accessoires de rituel bien-être naturel.">
  <meta property="og:url" content="https://www.respektus.com/boutique">
  <meta property="og:type" content="website">
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; color: #1A1A1A; background: #FAF7F2; }
    .header { display:flex; align-items:center; justify-content:space-between; padding:18px 28px; background:#FFFFFF; border-bottom:1px solid #EFE9DC; flex-wrap:wrap; gap:12px; }
    .header a.brand { text-decoration:none; color:#2C5F3F; font-weight:900; font-size:18px; letter-spacing:2px; }
    .header nav { display:flex; gap:18px; }
    .header nav a { text-decoration:none; color:#2C5F3F; font-weight:700; font-size:14px; padding:8px 14px; border-radius:8px; }
    .header nav a:hover, .header nav a.active { background:#EEF7F2; }

    .hero { background:#2C5F3F; padding:64px 24px; text-align:center; }
    .hero-eyebrow { color:#A8D5B5; font-size:12px; font-weight:800; letter-spacing:3px; text-transform:uppercase; }
    .hero h1 { color:#FFFFFF; font-size:44px; font-weight:900; margin:14px 0; letter-spacing:-0.5px; }
    .hero p { color:#D9EEE1; font-size:16px; max-width:640px; margin:0 auto; line-height:1.6; }
    .hero-shipping { display:inline-block; margin-top:24px; background:#FDF6E8; color:#B08A3E; font-weight:800; font-size:13px; padding:10px 22px; border-radius:12px; letter-spacing:0.3px; }

    main { max-width:1200px; margin:0 auto; padding:48px 24px 80px; }
    .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:28px; }
    .card { position:relative; background:#FFFFFF; border-radius:20px; overflow:hidden; border:1px solid #EFE9DC; transition: transform .15s, box-shadow .15s; }
    .card:hover { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(0,0,0,0.09); }
    .card-media { position:relative; }
    .card img { width:100%; height:300px; object-fit:cover; display:block; background:#EEF7F2; }
    .no-photo { width:100%; height:300px; background:#EEF7F2; }
    .badge { position:absolute; top:16px; left:16px; background:#2C5F3F; color:#FFF; font-size:11px; font-weight:800; padding:6px 14px; border-radius:10px; }
    .card-body { padding:22px; }
    .card-body h3 { font-size:19px; font-weight:800; margin:0 0 12px; line-height:1.35; color:#1A1A1A; }
    .price-row { display:flex; align-items:center; gap:10px; }
    .price { font-size:24px; font-weight:900; color:#2C5F3F; }
    .original-price { font-size:15px; color:#A0A0A0; text-decoration:line-through; }
    .out-of-stock { color:#C0392B; font-size:13px; font-weight:700; margin:10px 0 0; }
    .in-stock { color:#2C5F3F; font-size:12px; font-weight:700; margin:10px 0 0; }
    .delivery { color:#4A7C59; font-size:12px; font-weight:600; margin:4px 0 0; }
    .empty { text-align:center; padding:80px 20px; color:#8A8A8A; font-size:16px; }
    footer { padding:32px 24px; text-align:center; color:#8A8A8A; font-size:12px; border-top:1px solid #EFE9DC; background:#FFFFFF; margin-top:40px; }
    @media (max-width: 640px) { .hero { padding:44px 20px; } .hero h1 { font-size:30px; } main { padding:32px 16px 60px; } }
  </style>
</head>
<body>
  <header class="header">
    <a class="brand" href="/">RESPEKTUS<sup>®</sup></a>
    <nav>
      <a href="/actifs">Actifs</a>
      <a href="/recettes">Recettes</a>
      <a href="/boutique" class="active">Boutique</a>
      <a href="/blog">Blog</a>
      <a href="/a-propos">À propos</a>
    </nav>
  </header>
  <section class="hero">
    <div class="hero-eyebrow">La Boutique RESPEKTUS®</div>
    <h1>Tes accessoires rituel bien-être</h1>
    <p>Accessoires et outils de rituel bien-être naturel : diffuseurs d'huiles essentielles, gua sha, rouleaux de jade, brumisateurs et accessoires de soin — sélectionnés pour accompagner tes routines naturelles.</p>
    <span class="hero-shipping">Livraison offerte dès 35€ d'achat</span>
  </section>
  <main>
    ${products.length > 0 ? `<div class="grid">${cards}</div>` : `<div class="empty">De nouveaux produits arrivent bientôt.</div>`}
  </main>
  <footer>
    <p>RESPEKTUS® — Boutique d'accessoires bien-être naturel.</p>
    <p>Retrouve la boutique complète et Lia, ta conseillère beauté, dans l'app RESPEKTUS®.</p>
  </footer>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(html);
}
