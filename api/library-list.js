// Page SSR liste : /actifs (?type=actifs) et /recettes (?type=recettes)
// Fusionné en une seule fonction pour rester sous la limite de fonctions serverless
// du plan Vercel — les deux pages étaient quasi identiques en structure.

import { ACTIFS } from './_actifs-data.js';
import { RECETTES_BIBLIOTHEQUE } from './_recettes-data.js';

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Palette STRICTEMENT identique à l'app (src/screens/library/LibraryScreen.js)
const ACTIF_CAT_COLORS = {
  HE: { bg: '#EEF7F2', text: '#2C5F3F', label: 'Huiles essentielles' },
  HV: { bg: '#FFF8E6', text: '#C8A96E', label: 'Huiles végétales' },
  MACERAT: { bg: '#FBF0E1', text: '#B5793B', label: 'Macérâts huileux' },
  BEURRE: { bg: '#F8EFE6', text: '#A67C52', label: 'Beurres végétaux' },
  HYDROLAT: { bg: '#E8F4F7', text: '#4A8FA4', label: 'Hydrolats' },
  ARGILE: { bg: '#FAECE5', text: '#C0704F', label: 'Argiles' },
  POUDRE: { bg: '#EEF3E4', text: '#7A9B5E', label: 'Poudres végétales' },
  ACTIF: { bg: '#F0EBF7', text: '#7B5EA7', label: 'Actifs cosmétiques' },
  BASE: { bg: '#E8F3EC', text: '#4E8F6D', label: 'Bases et émulsifiants' },
  CONSERVATEUR: { bg: '#F0F0F0', text: '#6B6B6B', label: 'Conservateurs et stabilisants' },
  CULINAIRE: { bg: '#FBEAE7', text: '#C25B4E', label: 'Culinaires' },
};
const ACTIF_ORDER = ['HE', 'HV', 'MACERAT', 'BEURRE', 'HYDROLAT', 'ARGILE', 'POUDRE', 'ACTIF', 'BASE', 'CONSERVATEUR', 'CULINAIRE'];

const RECETTE_CAT_COLORS = {
  Visage: { bg: '#EEF7F2', text: '#2C5F3F' },
  Cheveux: { bg: '#EEF3E4', text: '#7A9B5E' },
  Corps: { bg: '#FFF8E6', text: '#C8A96E' },
  'Bien-être': { bg: '#E8F4F7', text: '#4A8FA4' },
  Minceur: { bg: '#FBF0E1', text: '#B5793B' },
  Homme: { bg: '#F0F0F0', text: '#6B6B6B' },
  Toilette: { bg: '#FAECE5', text: '#C0704F' },
};
const RECETTE_ORDER = ['Visage', 'Cheveux', 'Corps', 'Bien-être', 'Minceur', 'Homme', 'Toilette'];

function renderShell({ title, description, canonical, activeNav, pageTitle, pageSub, sections, footerCount, footerLabel }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${canonical}">
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
    .card .meta-line { font-size:11px; color:#8A8A8A; margin-top:8px; }
    .cat-badge { display:inline-block; padding:3px 9px; border-radius:999px; font-size:10px; font-weight:700; letter-spacing:0.4px; text-transform:uppercase; }
    footer { padding:32px 24px; text-align:center; color:#8A8A8A; font-size:12px; border-top:1px solid #EFE9DC; background:#FFFFFF; }
    @media (max-width: 640px) { main { padding:22px 16px 40px; } .page-header h1 { font-size:26px; } }
  </style>
</head>
<body>
  <header class="header">
    <a class="brand" href="/">RESPEKTUS<sup>®</sup></a>
    <nav>
      <a href="/actifs" ${activeNav === 'actifs' ? 'class="active"' : ''}>Actifs</a>
      <a href="/recettes" ${activeNav === 'recettes' ? 'class="active"' : ''}>Recettes</a>
      <a href="/calculateur">Calculateur</a>
      <a href="/boutique">Boutique</a>
      <a href="/blog">Blog</a>
      <a href="/a-propos">À propos</a>
    </nav>
  </header>
  <main>
    <header class="page-header">
      <h1>${esc(pageTitle)}</h1>
      <p>${pageSub}</p>
    </header>
    ${sections}
  </main>
  <footer>
    <p>RESPEKTUS® — Bibliothèque cosmétique scientifique et ethnobotanique.</p>
    <p>${footerCount} ${footerLabel} · Mis à jour ${new Date().toISOString().split('T')[0]}</p>
  </footer>
</body>
</html>`;
}

function renderActifs() {
  const byCat = {};
  for (const a of ACTIFS) {
    if (!byCat[a.categorie]) byCat[a.categorie] = [];
    byCat[a.categorie].push(a);
  }
  const sections = ACTIF_ORDER.map(key => {
    const items = (byCat[key] || []).sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'));
    if (items.length === 0) return '';
    const c = ACTIF_CAT_COLORS[key] || { bg: '#F5F5F5', text: '#666', label: key };
    const cards = items.map(a => `
      <a href="/actif/${esc(a.id)}" class="card" style="border-left:3px solid ${c.text}">
        <span class="cat-badge" style="background:${c.bg};color:${c.text}">${esc(a.type || a.categorie)}</span>
        <h3>${esc(a.nom)}</h3>
        ${a.nom_latin ? `<p class="latin">${esc(a.nom_latin)}</p>` : ''}
        <p class="snippet">${esc(((a.bienfaits || [])[0] || '').slice(0, 110))}</p>
      </a>`).join('');
    return `<section class="cat-section"><h2 style="color:${c.text}">${esc(c.label)} <span class="count">${items.length}</span></h2><div class="grid">${cards}</div></section>`;
  }).join('');

  return renderShell({
    title: `Tous les actifs (${ACTIFS.length}) — RESPEKTUS®`,
    description: `Bibliothèque RESPEKTUS® : ${ACTIFS.length} actifs naturels documentés — huiles essentielles, huiles végétales, hydrolats, beurres, argiles, poudres, actifs cosmétiques, bases et conservateurs.`,
    canonical: 'https://www.respektus.com/actifs',
    activeNav: 'actifs',
    pageTitle: 'Tous les actifs',
    pageSub: `${ACTIFS.length} actifs naturels documentés — huiles essentielles, huiles végétales, hydrolats, beurres, argiles, poudres végétales, actifs cosmétiques, bases et conservateurs. Chaque fiche détaille l'origine, la composition, les bienfaits, le dosage et les précautions.`,
    sections,
    footerCount: ACTIFS.length,
    footerLabel: 'actifs',
  });
}

function renderRecettes() {
  const byCat = {};
  for (const r of RECETTES_BIBLIOTHEQUE || []) {
    const k = r.categorie || 'Autre';
    if (!byCat[k]) byCat[k] = [];
    byCat[k].push(r);
  }
  const all = Object.keys(byCat).sort((a, b) => {
    const ai = RECETTE_ORDER.indexOf(a); const bi = RECETTE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const sections = all.map(cat => {
    const items = byCat[cat].sort((a, b) => (a.titre || '').localeCompare(b.titre || '', 'fr'));
    const c = RECETTE_CAT_COLORS[cat] || { bg: '#F5F5F5', text: '#666' };
    const cards = items.map(r => `
      <a href="/recette/${esc(r.id)}" class="card" style="border-left:3px solid ${c.text}">
        <span class="cat-badge" style="background:${c.bg};color:${c.text}">${esc(r.sousCategorie || cat)}</span>
        <h3>${esc(r.titre)}</h3>
        <p class="snippet">${esc((r.indications || '').slice(0, 140))}</p>
        <p class="meta-line">${r.duree ? esc(r.duree) : ''}${r.duree && r.frequence ? ' · ' : ''}${r.frequence ? esc(String(r.frequence).slice(0, 50)) : ''}</p>
      </a>`).join('');
    return `<section class="cat-section"><h2 style="color:${c.text}">${esc(cat)} <span class="count">${items.length}</span></h2><div class="grid">${cards}</div></section>`;
  }).join('');

  const total = (RECETTES_BIBLIOTHEQUE || []).length;
  return renderShell({
    title: `Toutes les recettes (${total}) — RESPEKTUS®`,
    description: `Bibliothèque RESPEKTUS® : ${total} recettes certifiées d'aromathérapie scientifique. Visage, cheveux, corps, bien-être. Sources, précautions et dosages détaillés.`,
    canonical: 'https://www.respektus.com/recettes',
    activeNav: 'recettes',
    pageTitle: 'Toutes les recettes',
    pageSub: `${total} recettes certifiées RESPEKTUS®, documentées scientifiquement et issues de la tradition aromathérapique française et ethnobotanique. Chaque fiche détaille les ingrédients, les étapes, les précautions et les sources.`,
    sections,
    footerCount: total,
    footerLabel: 'recettes',
  });
}

export default function handler(req, res) {
  const type = req.query?.type === 'recettes' ? 'recettes' : 'actifs';
  const html = type === 'recettes' ? renderRecettes() : renderActifs();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(html);
}
