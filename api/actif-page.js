// Page SSR pour un actif partagé : /actif/<id>
// Affiche les infos clés (nom, type, bienfaits) + CTA "Télécharger l'app"
// Les Open Graph tags permettent à WhatsApp/FB/iMessage d'afficher une preview.
//
// La base d'actifs est dupliquée en JS plat ici (lecture statique).
// Si on veut éviter la duplication, on pourrait l'extraire dans un JSON partagé.

import { ACTIFS } from './_actifs-data.js';

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const CATEGORY_COLORS = {
  HE: { bg: '#EEF7F2', text: '#2C5F3F' },
  HV: { bg: '#FFF8E6', text: '#C8A96E' },
  Hydrolat: { bg: '#EEF3FF', text: '#7B9EE0' },
  Beurre: { bg: '#FFF8E6', text: '#C8A96E' },
  Actif: { bg: '#FFF0F8', text: '#C05080' },
};

function notFound(id) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Actif introuvable — RESPEKTUS®</title>
<style>body{font-family:-apple-system,sans-serif;background:#FAF7F2;text-align:center;padding:80px 24px;color:#1A1A1A}
h1{color:#2C5F3F;margin-bottom:16px}a{color:#2C5F3F;text-decoration:none;font-weight:700}</style></head>
<body><h1>Actif introuvable</h1><p>L'actif "${escapeHtml(id)}" n'existe pas dans notre bibliothèque.</p>
<p style="margin-top:24px"><a href="/">← Retour à RESPEKTUS®</a></p></body></html>`;
}

export default function handler(req, res) {
  const id = req.query?.id;
  if (!id) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(notFound('manquant'));
  }
  const actif = ACTIFS.find(a => a.id === id);
  if (!actif) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(notFound(id));
  }

  const cfg = CATEGORY_COLORS[actif.categorie] || { bg: '#F0F0F0', text: '#666' };
  const url = `https://www.respektus.com/actif/${actif.id}`;
  const titleSafe = escapeHtml(actif.nom);
  const descSafe = escapeHtml((actif.bienfaits || []).slice(0, 3).join(' · '));
  const typeSafe = escapeHtml(actif.type || '');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titleSafe} — Actif naturel RESPEKTUS®</title>
<meta name="description" content="${descSafe}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${titleSafe} — RESPEKTUS®">
<meta property="og:description" content="${descSafe}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="RESPEKTUS">
<meta property="og:locale" content="fr_FR">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${titleSafe} — RESPEKTUS®">
<meta name="twitter:description" content="${descSafe}">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#FAF7F2;color:#1A1A1A;line-height:1.65}
.header{text-align:center;padding:32px 24px 22px;background:#FFF;border-bottom:1px solid #E8E0D5}
.brand{font-size:22px;font-weight:900;color:#2C5F3F;letter-spacing:4px;text-decoration:none}
.tagline{font-size:11px;color:#4A7C59;letter-spacing:1.5px;font-style:italic;margin-top:4px}
article{max-width:680px;margin:0 auto;padding:36px 24px 80px}
.type-badge{display:inline-block;background:${cfg.bg};color:${cfg.text};font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:6px 12px;border-radius:8px;margin-bottom:14px}
h1{font-size:34px;font-weight:800;line-height:1.2;color:#1A1A1A;margin-bottom:8px;letter-spacing:-0.5px}
.origin{font-size:13px;color:#6B6B6B;font-style:italic;margin-bottom:24px}
h2{font-size:16px;font-weight:800;color:#2C5F3F;text-transform:uppercase;letter-spacing:1px;margin-top:28px;margin-bottom:12px}
ul{list-style:none;padding:0}
li{padding:10px 0;border-bottom:1px solid #F0EBE5;font-size:15px;color:#2C2C2C;line-height:1.55;display:flex;align-items:flex-start;gap:10px}
li:last-child{border-bottom:none}
li:before{content:"•";color:${cfg.text};font-weight:800;font-size:18px;line-height:1}
.callout{background:${cfg.bg};border-radius:14px;padding:18px 22px;margin:14px 0;border-left:3px solid ${cfg.text}}
.callout p{font-size:14px;color:#2C2C2C;line-height:1.65}
.callout .label{font-size:11px;font-weight:800;color:${cfg.text};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px}
.warning{background:#FFF8E6;border-left:3px solid #C8A96E}
.warning .label{color:#C8A96E}
.cta-section{background:#2C5F3F;border-radius:18px;padding:32px 26px;margin-top:40px;text-align:center;color:#FFF}
.cta-title{font-size:22px;font-weight:800;margin-bottom:8px}
.cta-sub{font-size:14px;color:#C0DEC9;margin-bottom:22px;line-height:1.6}
.cta-btn{display:inline-block;background:#FFF;color:#2C5F3F;text-decoration:none;font-weight:800;font-size:14px;padding:14px 28px;border-radius:12px;margin:6px}
.cta-features{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-bottom:18px}
.cta-feature{font-size:11px;color:#A8D5B5;background:rgba(255,255,255,0.08);padding:5px 10px;border-radius:8px}
.footer{text-align:center;padding:32px 24px;font-size:12px;color:#B0B0B0;border-top:1px solid #E8E0D5;background:#FFF}
.footer a{color:#2C5F3F;text-decoration:none}
@media(max-width:600px){.header{padding:22px 16px 16px}article{padding:24px 18px 60px}h1{font-size:26px}}
</style>
</head>
<body>

<div class="header">
  <a href="/" class="brand">RESPEKTUS®</a>
  <div class="tagline">Pour une beauté qui nous respecte</div>
</div>

<article>
  <div class="type-badge">${typeSafe}</div>
  <h1>${titleSafe}</h1>
  ${actif.origine ? `<div class="origin">Origine : ${escapeHtml(actif.origine)}${actif.odeur ? ` · Odeur : ${escapeHtml(actif.odeur)}` : ''}</div>` : ''}

  ${actif.bienfaits?.length ? `
    <h2>Bienfaits</h2>
    <ul>${actif.bienfaits.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
  ` : ''}

  ${actif.utilisations?.length ? `
    <h2>Utilisations</h2>
    <ul>${actif.utilisations.map(u => `<li>${escapeHtml(u)}</li>`).join('')}</ul>
  ` : ''}

  ${actif.dosage ? `
    <div class="callout">
      <div class="label">Dosage recommandé</div>
      <p>${escapeHtml(actif.dosage)}</p>
    </div>
  ` : ''}

  ${actif.precautions ? `
    <div class="callout warning">
      <div class="label">Précautions</div>
      <p>${escapeHtml(actif.precautions)}</p>
    </div>
  ` : ''}

  <div class="cta-section">
    <div class="cta-title">Découvrez RESPEKTUS®</div>
    <div class="cta-sub">120+ actifs naturels, 124 recettes certifiées aromathérapie scientifique, votre assistante Lia, et une communauté bienveillante.</div>
    <div class="cta-features">
      <span class="cta-feature">Hors connexion</span>
      <span class="cta-feature">Gratuit</span>
      <span class="cta-feature">Sans publicité</span>
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
