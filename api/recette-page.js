// Page SSR pour une recette partagée : /recette/<id>
// Affiche la recette complète + CTA téléchargement de l'app.
// OG tags pour previews sur réseaux sociaux + messageries.

import { RECETTES_BIBLIOTHEQUE } from './_recettes-data.js';
import { ACTIFS } from './_actifs-data.js';

const ACTIFS_COUNT = Math.floor(ACTIFS.length / 50) * 50; // chiffre rond pour l'affichage marketing

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Détecte PMID / PMC / DOI dans un texte de source et les transforme en liens cliquables.
const SOURCE_LINK_RE = /(PMID[:\s]*\d{6,9}|PMC\d{6,9}|DOI[:\s]*10\.\d{4,9}\/\S+?(?=[\s,;)]|$))/gi;
function sourceLinkUrl(match) {
  const m = match.trim();
  const pmid = m.match(/PMID[:\s]*(\d{6,9})/i);
  if (pmid) return `https://pubmed.ncbi.nlm.nih.gov/${pmid[1]}/`;
  const pmc = m.match(/PMC(\d{6,9})/i);
  if (pmc) return `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmc[1]}/`;
  const doi = m.match(/DOI[:\s]*(10\.\d{4,9}\/\S+)/i);
  if (doi) return `https://doi.org/${doi[1].replace(/[.,;)]+$/, '')}`;
  return null;
}
function linkifySource(text) {
  const parts = String(text || '').split(SOURCE_LINK_RE);
  return parts.map(p => {
    const url = sourceLinkUrl(p);
    if (url) return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" style="color:#2C5F3F;font-weight:700;text-decoration:underline">${escapeHtml(p.trim().replace(/\.$/, ''))}</a>`;
    return escapeHtml(p);
  }).join('');
}

// ===== Pourcentages exacts (identique à src/services/recipeFormat.js de l'app) =====
// Composition totalisant NET 100.00 % calculée depuis les quantités (1 ml = 25 gouttes).
function parseQuantityMl(quantite) {
  if (!quantite) return null;
  const q = String(quantite).toLowerCase().replace(/,/g, '.');
  let m = q.match(/(\d+(?:\.\d+)?)\s*ml\b/);
  if (m) return parseFloat(m[1]);
  m = q.match(/(\d+(?:\.\d+)?)\s*gouttes?\b/);
  if (m) return parseFloat(m[1]) / 25;
  m = q.match(/(\d+(?:\.\d+)?)\s*g\b/);
  if (m) return parseFloat(m[1]);
  if (/cuill[eè]re.*soupe/.test(q)) return 15;
  if (/cuill[eè]re.*caf[eé]/.test(q)) return 5;
  return null;
}
function ingredientsWithPercentages(ingredients) {
  const items = (ingredients || []).map(ing => ({ ...ing, mlValue: parseQuantityMl(ing.quantite) }));
  const measurable = items.filter(i => i.mlValue && i.mlValue > 0);
  const totalMl = measurable.reduce((sum, i) => sum + i.mlValue, 0);
  if (!totalMl || measurable.length < 2) return { items: items.map(({ mlValue, ...r }) => ({ ...r, pct: null })), total: null, totalMl: null };
  let allocated = 0;
  measurable.forEach((item, idx) => {
    const isLast = idx === measurable.length - 1;
    const pct = isLast ? Math.round((100 - allocated) * 100) / 100 : Math.round((item.mlValue / totalMl) * 100 * 100) / 100;
    allocated = Math.round((allocated + pct) * 100) / 100;
    item.computedPct = pct;
  });
  return {
    items: items.map(({ mlValue, computedPct, ...r }) => (computedPct !== undefined ? { ...r, pct: computedPct } : { ...r, pct: null })),
    total: '100.00',
    totalMl,
  };
}
function cleanQuantity(q) {
  let t = String(q || '').replace(/\s*—\s*/g, ', ');
  t = t.replace(/~?\d+(?:[.,]\d+)?\s*%/g, '');
  t = t.replace(/\(\s*[,;]?\s*\)/g, '');
  t = t.replace(/\(\s*[,;]\s*/g, '(');
  t = t.replace(/\s{2,}/g, ' ').trim();
  t = t.replace(/^[,;]\s*/, '').replace(/\s*[,;]\s*$/, '');
  const m = t.match(/^\((.*)\)$/);
  if (m) t = m[1].trim();
  return t;
}
function formatTotalVolume(totalMl) {
  if (!totalMl || totalMl <= 0) return null;
  if (totalMl < 1) return `${Math.max(1, Math.round(totalMl * 25))} gouttes`;
  if (totalMl < 10) return `${Math.round(totalMl)} ml`;
  return `${Math.round(totalMl / 5) * 5} ml`;
}

function notFound(id) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Recette introuvable — RESPEKTUS®</title>
<style>body{font-family:-apple-system,sans-serif;background:#FAF7F2;text-align:center;padding:80px 24px;color:#1A1A1A}
h1{color:#2C5F3F;margin-bottom:16px}a{color:#2C5F3F;text-decoration:none;font-weight:700}</style></head>
<body><h1>Recette introuvable</h1><p>La recette "${escapeHtml(id)}" n'existe pas dans notre bibliothèque.</p>
<p style="margin-top:24px"><a href="/">← Retour à RESPEKTUS®</a></p></body></html>`;
}

export default function handler(req, res) {
  const id = req.query?.id;
  if (!id) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(notFound('manquant'));
  }
  const recipe = RECETTES_BIBLIOTHEQUE.find(r => r.id === id);
  if (!recipe) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(notFound(id));
  }

  const url = `https://www.respektus.com/recette/${recipe.id}`;
  const titleSafe = escapeHtml(recipe.titre);
  const descSafe = escapeHtml(recipe.indications || '');
  const catSafe = escapeHtml(recipe.categorie || '');

  const { items: ingItems, total: pctTotal, totalMl } = ingredientsWithPercentages(recipe.ingredients);
  const ingredientsHtml = ingItems.map(ing => {
    const nom = escapeHtml(ing.nom || '');
    const qte = escapeHtml(cleanQuantity(ing.quantite || ''));
    const pct = ing.pct != null ? `<span class="ing-pct">${ing.pct.toFixed(2)} %</span>` : '';
    return `<li class="ing-row"><span class="ing-main"><strong>${nom}</strong>${qte ? `<span class="ing-qty">${qte}</span>` : ''}</span>${pct}</li>`;
  }).join('') + (pctTotal ? `<li class="ing-total"><span>Total${formatTotalVolume(totalMl) ? ` (${formatTotalVolume(totalMl)})` : ''}</span><span class="ing-pct">${pctTotal} %</span></li>` : '');

  const etapesHtml = (recipe.etapes || []).map((e, i) => `<li><span class="step-num">${i + 1}</span>${escapeHtml(e)}</li>`).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titleSafe} · Recette RESPEKTUS®</title>
<meta name="description" content="${descSafe}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${titleSafe} · Recette RESPEKTUS®">
<meta property="og:description" content="${descSafe}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="RESPEKTUS">
<meta property="og:locale" content="fr_FR">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${titleSafe}">
<meta name="twitter:description" content="${descSafe}">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#FAF7F2;color:#1A1A1A;line-height:1.65}
.header{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;background:#FFF;border-bottom:1px solid #E8E0D5;gap:12px;flex-wrap:wrap}
.brand{font-size:18px;font-weight:900;color:#2C5F3F;letter-spacing:2px;text-decoration:none}
.header-nav{display:flex;gap:8px;flex-wrap:wrap}
.header-nav a{text-decoration:none;color:#2C5F3F;font-weight:700;font-size:13px;padding:6px 12px;border-radius:8px}
.header-nav a:hover{background:#EEF7F2}
.back-bar{background:#FAF7F2;padding:14px 24px;border-bottom:1px solid #EFE9DC}
.back-link{display:inline-flex;align-items:center;gap:6px;color:#2C5F3F;text-decoration:none;font-weight:700;font-size:14px;background:#FFF;padding:8px 14px;border-radius:999px;border:1px solid #C0DEC9}
.back-link:hover{background:#EEF7F2}
article{max-width:680px;margin:0 auto;padding:36px 24px 80px}
.cat-badge{display:inline-block;background:#EEF7F2;color:#2C5F3F;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:6px 12px;border-radius:8px;margin-bottom:14px}
h1{font-size:30px;font-weight:800;line-height:1.25;color:#1A1A1A;margin-bottom:8px;letter-spacing:-0.4px}
.indications{font-size:15px;color:#4A4A4A;font-style:italic;margin-bottom:24px;line-height:1.6}
.meta-row{display:flex;gap:18px;margin-bottom:30px;flex-wrap:wrap}
.meta{font-size:13px;color:#6B6B6B;background:#FFF;padding:8px 14px;border-radius:10px;border:1px solid #E8E0D5}
.meta strong{color:#2C5F3F;font-weight:700}
h2{font-size:18px;font-weight:800;color:#2C5F3F;text-transform:uppercase;letter-spacing:1px;margin-top:30px;margin-bottom:14px}
.card{background:#FFF;border-radius:14px;padding:18px 22px;border:1px solid #E8E0D5;margin-bottom:10px}
.card ul{list-style:none;padding:0}
.card li{padding:10px 0;border-bottom:1px solid #F0EBE5;font-size:15px;color:#2C2C2C;line-height:1.5}
.card li:last-child{border-bottom:none}
.ing-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.ing-main{display:flex;flex-direction:column;gap:2px}
.ing-qty{font-size:12px;color:#8A8A8A}
.ing-pct{font-weight:800;color:#2C5F3F;white-space:nowrap}
.ing-total{display:flex;justify-content:space-between;font-weight:800;border-top:2px solid #E8E0D5 !important;margin-top:4px}
.steps{counter-reset:step}
.steps li{display:flex;align-items:flex-start;gap:14px;padding:14px 0}
.step-num{flex-shrink:0;width:28px;height:28px;border-radius:14px;background:#2C5F3F;color:#FFF;font-weight:800;font-size:14px;display:inline-flex;align-items:center;justify-content:center}
.warning{background:#FFF8E6;border-left:3px solid #C8A96E;border-radius:14px;padding:16px 20px;margin:18px 0}
.warning-label{font-size:11px;font-weight:800;color:#C8A96E;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px}
.warning-text{font-size:14px;color:#5C4A2C;line-height:1.6}
.source{font-size:12px;color:#A0A0A0;font-style:italic;margin-top:24px;padding-top:14px;border-top:1px solid #E8E0D5}
.cta-section{background:#2C5F3F;border-radius:18px;padding:32px 26px;margin-top:40px;text-align:center;color:#FFF}
.cta-title{font-size:22px;font-weight:800;margin-bottom:8px}
.cta-sub{font-size:14px;color:#C0DEC9;margin-bottom:22px;line-height:1.6}
.cta-btn{display:inline-block;background:#FFF;color:#2C5F3F;text-decoration:none;font-weight:800;font-size:14px;padding:14px 28px;border-radius:12px;margin:6px}
.cta-features{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-bottom:18px}
.cta-feature{font-size:11px;color:#A8D5B5;background:rgba(255,255,255,0.08);padding:5px 10px;border-radius:8px}
.footer{text-align:center;padding:32px 24px;font-size:12px;color:#B0B0B0;border-top:1px solid #E8E0D5;background:#FFF}
.footer a{color:#2C5F3F;text-decoration:none}
@media(max-width:600px){.header{padding:22px 16px 16px}article{padding:24px 18px 60px}h1{font-size:24px}}
</style>
</head>
<body>

<div class="header">
  <a href="/" class="brand">RESPEKTUS®</a>
  <nav class="header-nav">
    <a href="/actifs">Actifs</a>
    <a href="/recettes">Recettes</a>
    <a href="/calculateur">Calculateur</a>
    <a href="/blog">Blog</a>
    <a href="/a-propos">À propos</a>
  </nav>
</div>

<div class="back-bar">
  <a href="/recettes" class="back-link"><span style="font-size:18px;line-height:1">←</span> Toutes les recettes</a>
</div>

<article>
  <div class="cat-badge">${catSafe}${recipe.sousCategorie ? ` · ${escapeHtml(recipe.sousCategorie)}` : ''}</div>
  <h1>${titleSafe}</h1>
  ${recipe.indications ? `<div class="indications">${escapeHtml(recipe.indications)}</div>` : ''}

  <div class="meta-row">
    ${recipe.duree ? `<div class="meta"><strong>Durée :</strong> ${escapeHtml(recipe.duree)}</div>` : ''}
    ${recipe.frequence ? `<div class="meta"><strong>Fréquence :</strong> ${escapeHtml(recipe.frequence)}</div>` : ''}
  </div>

  ${ingredientsHtml ? `
    <h2>Ingrédients</h2>
    <div class="card"><ul>${ingredientsHtml}</ul></div>
  ` : ''}

  ${etapesHtml ? `
    <h2>Étapes</h2>
    <div class="card"><ul class="steps">${etapesHtml}</ul></div>
  ` : ''}

  ${recipe.precautions ? `
    <div class="warning">
      <div class="warning-label">Précautions</div>
      <div class="warning-text">${escapeHtml(recipe.precautions)}</div>
    </div>
  ` : ''}

  ${recipe.source ? `<div class="source">Source : ${linkifySource(recipe.source)}</div>` : ''}

  <div class="cta-section">
    <div class="cta-title">Vous voulez plus de recettes ?</div>
    <div class="cta-sub">${RECETTES_BIBLIOTHEQUE.length} recettes certifiées aromathérapie scientifique, +${ACTIFS_COUNT} actifs naturels détaillés, votre assistante Lia, et une communauté bienveillante vous attendent dans l'app RESPEKTUS®.</div>
    <div class="cta-features">
      <span class="cta-feature">Hors connexion</span>
      <span class="cta-feature">Gratuit</span>
    </div>
    <a href="https://apps.apple.com/" class="cta-btn">App Store</a>
    <a href="https://play.google.com/store" class="cta-btn">Google Play</a>
  </div>
</article>

<div class="footer">
  <p>© 2026 RESPEKTUS® — Tous droits réservés</p>
  <p style="margin-top:8px">
    <a href="/blog">Blog</a> ·
    <a href="/charte">Charte du Cercle</a> ·
    <a href="/mentions-legales">Mentions légales</a> ·
    <a href="/confidentialite">Confidentialité</a>
  </p>
</div>

</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(html);
}
