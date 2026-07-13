// Rend une page HTML pour un article individuel /blog/<slug>.
// Server-side : injecte les bonnes balises Open Graph pour le partage social
// (Facebook, Twitter, LinkedIn, WhatsApp affichent une preview avec image + titre).

const CACHE_TTL_MS = 60 * 1000;
let _cache = null;
let _cacheAt = 0;

function slugify(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Le champ Contenu accepte deux écritures : du HTML direct (<h2>, <p>, <strong>...)
// ou l'ancienne convention **texte** (compatible avec la version de l'app encore publiée
// tant que le prochain build, qui sait lire le HTML, n'est pas sorti). On détecte laquelle
// est utilisée et on produit du HTML dans les deux cas.
function articleContentHtml(text) {
  const raw = String(text || '');
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw;
  return raw.split('\n').map(line => {
    const t = line.trim();
    if (!t) return '';
    if (t.startsWith('**') && t.endsWith('**') && t.length > 4) {
      return `<h2>${escapeHtml(t.slice(2, -2))}</h2>`;
    }
    const inline = t.split(/(\*\*[^*]+\*\*)/g)
      .map(p => (p.startsWith('**') && p.endsWith('**')) ? `<strong>${escapeHtml(p.slice(2, -2))}</strong>` : escapeHtml(p))
      .join('');
    return `<p>${inline}</p>`;
  }).filter(Boolean).join('\n');
}

async function fetchArticles() {
  const now = Date.now();
  if (_cache && (now - _cacheAt) < CACHE_TTL_MS) return _cache;
  const base = process.env.AIRTABLE_BASE_ID;
  const key = process.env.AIRTABLE_API_KEY;
  const url = `https://api.airtable.com/v0/${base}/${encodeURIComponent('Blog')}?filterByFormula=${encodeURIComponent('{Publié}=TRUE()')}&sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=desc`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  const data = await r.json();
  if (!data.records) return [];
  const seen = new Map();
  _cache = data.records.map(rec => {
    const f = rec.fields || {};
    const photos = f['Photo'];
    const photo = Array.isArray(photos) && photos.length > 0 ? photos[0].url : null;
    let slug = slugify(f['Titre'] || rec.id);
    if (seen.has(slug)) { const n = seen.get(slug) + 1; seen.set(slug, n); slug = `${slug}-${n}`; }
    else { seen.set(slug, 1); }
    return {
      id: rec.id, slug,
      title: f['Titre'] || '', category: f['Categorie'] || 'Aromathérapie',
      intro: f['Intro'] || '', content: f['Contenu'] || '', tip: f['Conseil'] || '',
      cta: f['CTA'] || '', ctaLink: f['CTA Lien'] || f['CTA LIEN'] || '',
      photo, date: f['Date'] || '',
    };
  });
  _cacheAt = now;
  return _cache;
}

export default async function handler(req, res) {
  const slug = req.query?.slug;
  if (!slug) return res.status(400).send('Slug manquant');

  try {
    const articles = await fetchArticles();
    const a = articles.find(x => x.slug === slug);
    if (!a) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(notFoundPage(slug));
    }

    const dateFormatted = a.date ? new Date(a.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const url = `https://www.respektus.com/blog/${a.slug}`;
    // Versions texte pur pour <title>, meta tags, JSON-LD, attributs alt/href : le HTML y casserait tout.
    const descSafe = escapeHtml((a.intro || '').replace(/<[^>]+>/g, '').slice(0, 200));
    const titleSafe = escapeHtml((a.title || '').replace(/<[^>]+>/g, ''));
    // Versions affichées dans la page : HTML inline (<strong>, <em>...) toléré tel quel.
    const titleHtml = a.title || '';
    const introHtml = a.intro || '';
    const datePublished = a.date ? new Date(a.date).toISOString() : new Date().toISOString();

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: a.title,
      description: a.intro,
      image: a.photo ? [a.photo] : undefined,
      datePublished,
      dateModified: datePublished,
      author: { '@type': 'Organization', name: 'RESPEKTUS', url: 'https://www.respektus.com' },
      publisher: {
        '@type': 'Organization',
        name: 'RESPEKTUS',
        logo: { '@type': 'ImageObject', url: 'https://www.respektus.com/logo.png' },
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      articleSection: a.category,
      inLanguage: 'fr-FR',
    };
    const jsonLdStr = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titleSafe} — RESPEKTUS®</title>
<meta name="description" content="${descSafe}">
<meta name="robots" content="index, follow">
<meta name="author" content="RESPEKTUS">
<link rel="canonical" href="${url}">

<meta property="og:title" content="${titleSafe}">
<meta property="og:description" content="${descSafe}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="RESPEKTUS">
<meta property="og:locale" content="fr_FR">
<meta property="article:published_time" content="${datePublished}">
<meta property="article:section" content="${escapeHtml(a.category)}">
${a.photo ? `<meta property="og:image" content="${escapeHtml(a.photo)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${titleSafe}">
<meta name="twitter:description" content="${descSafe}">
${a.photo ? `<meta name="twitter:image" content="${escapeHtml(a.photo)}">` : ''}

<script type="application/ld+json">${jsonLdStr}</script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Georgia,serif;background:#FAF7F2;color:#1A1A1A;line-height:1.65}
.header{text-align:center;padding:40px 24px 24px;background:#FFF;border-bottom:1px solid #E8E0D5}
.brand{font-size:20px;font-weight:900;color:#2C5F3F;letter-spacing:4px;text-decoration:none}
.back{display:inline-block;margin-top:12px;color:#2C5F3F;text-decoration:none;font-weight:600;font-size:13px}

article{max-width:720px;margin:0 auto;padding:50px 24px 80px}
.cat{display:inline-block;background:#EEF7F2;color:#2C5F3F;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:6px 12px;border-radius:8px;margin-bottom:18px}
h1{font-size:36px;font-weight:800;line-height:1.2;color:#1A1A1A;letter-spacing:-0.5px;margin-bottom:14px}
.date{font-size:13px;color:#8A8A8A;font-style:italic;margin-bottom:28px}
.cover{width:100%;aspect-ratio:16/9;object-fit:contain;border-radius:14px;margin-bottom:32px;background:#EEF7F2;display:block}
.intro{font-size:18px;color:#3D3D3D;line-height:1.7;margin-bottom:28px;font-style:italic;border-left:3px solid #2C5F3F;padding-left:18px}
.content h2{font-size:22px;font-weight:800;color:#2C5F3F;line-height:1.3;margin:34px 0 14px}
.content h3{font-size:18px;font-weight:800;color:#2C5F3F;line-height:1.3;margin:28px 0 12px}
.content p{font-size:16px;color:#2C2C2C;line-height:1.75;margin-bottom:20px}
.content strong,.content b{color:#1A1A1A;font-weight:700}
.content em,.content i{font-style:italic}
.content a{color:#2C5F3F;font-weight:700}
.content ul,.content ol{margin:0 0 20px 22px}
.content li{font-size:16px;color:#2C2C2C;line-height:1.75;margin-bottom:8px}
.tip{background:#FFF8E6;border-radius:14px;padding:22px 26px;margin:36px 0;border-left:3px solid #C8A96E}
.tip-label{font-size:11px;font-weight:800;color:#C8A96E;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px}
.tip-text{font-size:15px;color:#5C4A2C;line-height:1.7}
.cta{margin:36px 0;text-align:center}
.cta-btn{display:inline-block;background:#2C5F3F;color:#FFF;font-weight:700;font-size:15px;padding:14px 30px;border-radius:12px;text-decoration:none}
.cta-text{font-size:15px;font-weight:700;color:#2C5F3F}

.share{margin-top:48px;padding-top:28px;border-top:1px solid #E8E0D5}
.share-label{font-size:11px;font-weight:800;color:#8A8A8A;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px}
.share-row{display:flex;gap:10px;flex-wrap:wrap}
.share-btn{background:#FFF;border:1px solid #E8E0D5;border-radius:10px;padding:10px 16px;font-size:13px;color:#2C5F3F;text-decoration:none;font-weight:600}
.share-btn:hover{background:#EEF7F2}

.footer{text-align:center;padding:40px 24px;font-size:12px;color:#B0B0B0;border-top:1px solid #E8E0D5;background:#FFF}
.footer a{color:#2C5F3F;text-decoration:none}

@media(max-width:600px){
  .header{padding:24px 16px 18px}
  article{padding:30px 18px 60px}
  h1{font-size:26px}
  .intro{font-size:16px}
  .content p{font-size:15px}
}
</style>
</head>
<body>

<div class="header">
  <a href="/" class="brand">RESPEKTUS®</a><br>
  <a href="/blog" class="back">← Tous les articles</a>
</div>

<article>
  <span class="cat">${escapeHtml(a.category)}</span>
  <h1>${titleHtml}</h1>
  ${dateFormatted ? `<div class="date">${escapeHtml(dateFormatted)}</div>` : ''}
  ${a.photo ? `<img class="cover" src="${escapeHtml(a.photo)}" alt="${titleSafe}">` : ''}
  ${a.intro ? `<div class="intro">${introHtml}</div>` : ''}
  <div class="content">${articleContentHtml(a.content)}</div>
  ${a.tip ? `
    <div class="tip">
      <div class="tip-label">Le conseil RESPEKTUS</div>
      <div class="tip-text">${escapeHtml(a.tip).replace(/\n/g, '<br>')}</div>
    </div>
  ` : ''}

  ${a.cta ? `
    <div class="cta">
      ${a.ctaLink
        ? `<a class="cta-btn" href="${escapeHtml(a.ctaLink)}" target="_blank" rel="noopener">${escapeHtml(a.cta)}</a>`
        : `<div class="cta-text">${escapeHtml(a.cta)}</div>`}
    </div>
  ` : ''}

  <div class="share">
    <div class="share-label">Partager cet article</div>
    <div class="share-row">
      <a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener">Facebook</a>
      <a class="share-btn" href="https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(a.title)}" target="_blank" rel="noopener">Twitter</a>
      <a class="share-btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}" target="_blank" rel="noopener">LinkedIn</a>
      <a class="share-btn" href="https://wa.me/?text=${encodeURIComponent(a.title + ' — ' + url)}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="share-btn" href="mailto:?subject=${encodeURIComponent(a.title)}&body=${encodeURIComponent(a.intro + '\\n\\n' + url)}">Email</a>
    </div>
  </div>
</article>

<div class="footer">
  <p>© 2026 RESPEKTUS® — Tous droits réservés</p>
  <p style="margin-top:8px">
    <a href="/mentions-legales">Mentions légales</a> ·
    <a href="/cgv">CGV</a> ·
    <a href="/confidentialite">Confidentialité</a> ·
    <a href="/parrainage#fidelite">Fidélité</a> ·
    <a href="/parrainage#parrainage">Parrainage</a>
  </p>
</div>

</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');
    return res.status(200).send(html);
  } catch (e) {
    console.error('blog-page error:', e);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(notFoundPage(slug, e.message));
  }
}

function notFoundPage(slug, msg = '') {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Article introuvable — RESPEKTUS®</title>
<style>body{font-family:-apple-system,sans-serif;background:#FAF7F2;text-align:center;padding:80px 24px;color:#1A1A1A}
h1{color:#2C5F3F;margin-bottom:16px}a{color:#2C5F3F;text-decoration:none;font-weight:700}</style></head>
<body><h1>Article introuvable</h1><p>L'article "${escapeHtml(slug)}" n'existe pas ou n'est plus publié.</p>
${msg ? `<p style="color:#A0A0A0;font-size:12px;margin-top:14px">${escapeHtml(msg)}</p>` : ''}
<p style="margin-top:24px"><a href="/blog">← Voir tous les articles</a></p></body></html>`;
}
