// Page SSR liste de tous les actifs : /actifs
// Rendue par Vercel rewrites (vercel.json : /actifs → /api/actifs-list)

import { ACTIFS } from './_actifs-data.js';

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const CAT_COLORS = {
  HE: { bg: '#EEF3FF', text: '#5E80C0', label: 'Huiles essentielles' },
  HV: { bg: '#EEF7F2', text: '#2C5F3F', label: 'Huiles végétales' },
  MACERAT: { bg: '#FFF1E8', text: '#D97757', label: 'Macérâts huileux' },
  BEURRE: { bg: '#FFF8E6', text: '#C8A96E', label: 'Beurres végétaux' },
  HYDROLAT: { bg: '#F4F0FF', text: '#9B8EE0', label: 'Hydrolats' },
  ARGILE: { bg: '#F5F1EA', text: '#8A7E62', label: 'Argiles' },
  POUDRE: { bg: '#F0F5E8', text: '#5C7A3D', label: 'Poudres végétales' },
  ACTIF: { bg: '#FFF0F8', text: '#C05080', label: 'Actifs cosmétiques' },
  BASE: { bg: '#EFEFEF', text: '#3D3D3D', label: 'Bases et émulsifiants' },
  CONSERVATEUR: { bg: '#E8F0EC', text: '#4A6B58', label: 'Conservateurs et stabilisants' },
};

export default function handler(req, res) {
  const byCat = {};
  for (const a of ACTIFS) {
    if (!byCat[a.categorie]) byCat[a.categorie] = [];
    byCat[a.categorie].push(a);
  }
  const order = ['HE', 'HV', 'MACERAT', 'BEURRE', 'HYDROLAT', 'ARGILE', 'POUDRE', 'ACTIF', 'BASE', 'CONSERVATEUR'];

  const sections = order.map(key => {
    const items = (byCat[key] || []).sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'));
    if (items.length === 0) return '';
    const c = CAT_COLORS[key] || { bg: '#F5F5F5', text: '#666', label: key };
    const cards = items.map(a => `
      <a href="/actif/${esc(a.id)}" class="card" style="border-left:3px solid ${c.text}">
        <span class="cat-badge" style="background:${c.bg};color:${c.text}">${esc(a.type || a.categorie)}</span>
        <h3>${esc(a.nom)}</h3>
        ${a.nom_latin ? `<p class="latin">${esc(a.nom_latin)}</p>` : ''}
        <p class="snippet">${esc(((a.bienfaits || [])[0] || '').slice(0, 110))}</p>
      </a>`).join('');
    return `
      <section class="cat-section">
        <h2 style="color:${c.text}">${esc(c.label)} <span class="count">${items.length}</span></h2>
        <div class="grid">${cards}</div>
      </section>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tous les actifs (${ACTIFS.length}) — RESPEKTUS®</title>
  <meta name="description" content="Bibliothèque RESPEKTUS® : ${ACTIFS.length} actifs naturels documentés — huiles essentielles, huiles végétales, hydrolats, beurres, argiles, poudres, actifs cosmétiques, bases et conservateurs.">
  <link rel="canonical" href="https://www.respektus.com/actifs">
  <meta property="og:title" content="Tous les actifs RESPEKTUS®">
  <meta property="og:description" content="${ACTIFS.length} actifs naturels documentés scientifiquement.">
  <meta property="og:url" content="https://www.respektus.com/actifs">
  <meta property="og:type" content="website">
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; color: #1A1A1A; background: #FAF7F2; }
    .header { display:flex; align-items:center; justify-content:space-between; padding:18px 28px; background:#FFFFFF; border-bottom:1px solid #EFE9DC; flex-wrap:wrap; gap:12px; }
    .header a.brand { text-decoration:none; color:#2C5F3F; font-weight:900; font-size:18px; letter-spacing:2px; }
    .header nav { display:flex; gap:18px; }
    .header nav a { text-decoration:none; color:#2C5F3F; font-weight:700; font-size:14px; padding:8px 14px; border-radius:8px; }
    .header nav a:hover, .header nav a.active { background:#EEF7F2; }
    main { max-width:1080px; margin:0 auto; padding:32px 24px 60px; }
    .page-header h1 { font-size:32px; font-weight:300; letter-spacing:-0.4px; margin:0 0 8px; }
    .page-header p { color:#5C5C5C; font-size:14px; max-width:680px; line-height:1.6; }
    .cat-section { margin-top:36px; }
    .cat-section h2 { font-size:18px; font-weight:700; margin:0 0 14px; display:flex; align-items:center; gap:10px; }
    .cat-section .count { background:#FFFFFF; color:#6B6B6B; font-size:12px; font-weight:600; padding:2px 8px; border-radius:8px; border:1px solid #EFE9DC; }
    .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px; }
    .card { display:block; background:#FFFFFF; border-radius:14px; padding:14px; text-decoration:none; color:inherit; border:1px solid #EFE9DC; transition: transform .12s, box-shadow .12s; }
    .card:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
    .card h3 { font-size:15px; font-weight:700; margin:8px 0 4px; line-height:1.3; color:#1A1A1A; }
    .card .latin { font-size:11px; color:#8A7E62; font-style:italic; margin:0; }
    .card .snippet { font-size:12px; color:#6B6B6B; margin:6px 0 0; line-height:1.5; overflow:hidden; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; }
    .cat-badge { display:inline-block; padding:3px 9px; border-radius:999px; font-size:10px; font-weight:700; letter-spacing:0.4px; text-transform:uppercase; }
    footer { padding:32px 24px; text-align:center; color:#8A8A8A; font-size:12px; border-top:1px solid #EFE9DC; background:#FFFFFF; }
    @media (max-width: 640px) { main { padding:22px 16px 40px; } .page-header h1 { font-size:26px; } }
  </style>
</head>
<body>
  <header class="header">
    <a class="brand" href="/">RESPEKTUS<sup>®</sup></a>
    <nav>
      <a href="/actifs" class="active">Actifs</a>
      <a href="/recettes">Recettes</a>
      <a href="/blog">Blog</a>
      <a href="/a-propos">À propos</a>
    </nav>
  </header>
  <main>
    <header class="page-header">
      <h1>Tous les actifs</h1>
      <p>${ACTIFS.length} actifs naturels documentés — huiles essentielles, huiles végétales, hydrolats, beurres, argiles, poudres végétales, actifs cosmétiques, bases et conservateurs. Chaque fiche détaille l'origine, la composition, les bienfaits, le dosage et les précautions.</p>
    </header>
    ${sections}
  </main>
  <footer>
    <p>RESPEKTUS® — Bibliothèque cosmétique scientifique et ethnobotanique.</p>
    <p>${ACTIFS.length} actifs · Mis à jour ${new Date().toISOString().split('T')[0]}</p>
  </footer>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(html);
}
