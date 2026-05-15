// Page SSR pour un post du Cercle partagé : /post/<id>
// Affiche le contenu du post + média + CTA téléchargement de l'app.
// OG tags pour preview riche sur WhatsApp/FB/Twitter/iMessage.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dvwcbpekhsteyzwvxixs.supabase.co';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function notFound(id, msg = '') {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Publication introuvable — RESPEKTUS®</title>
<style>body{font-family:-apple-system,sans-serif;background:#FAF7F2;text-align:center;padding:80px 24px;color:#1A1A1A}
h1{color:#2C5F3F;margin-bottom:16px}a{color:#2C5F3F;text-decoration:none;font-weight:700}</style></head>
<body><h1>Publication introuvable</h1><p>Cette publication n'existe pas ou n'est plus visible.</p>
${msg ? `<p style="color:#A0A0A0;font-size:12px;margin-top:14px">${escapeHtml(msg)}</p>` : ''}
<p style="margin-top:24px"><a href="/">← Retour à RESPEKTUS®</a></p></body></html>`;
}

export default async function handler(req, res) {
  const id = req.query?.id;
  if (!id) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(notFound(id || 'manquant'));
  }

  try {
    // Récupération du post via l'API REST Supabase (anon key, RLS s'applique)
    const apiUrl = `${SUPABASE_URL}/rest/v1/community_posts?id=eq.${id}&select=*`;
    const resp = await fetch(apiUrl, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!resp.ok) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(500).send(notFound(id, 'Erreur API ' + resp.status));
    }
    const rows = await resp.json();
    const post = Array.isArray(rows) && rows[0];
    if (!post || post.status !== 'approved') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(notFound(id));
    }

    const url = `https://www.respektus.com/post/${post.id}`;
    const authorSafe = escapeHtml(post.author_name || 'Un membre');
    const contentSafe = escapeHtml(post.content || '').replace(/\n/g, '<br>');
    const descSafe = escapeHtml((post.content || '').slice(0, 200));
    const tagSafe = escapeHtml(post.tag || 'Partage');
    const isVideo = post.media_type === 'video';
    const photoUrl = post.photo_url || null;

    // Date formatée FR
    let dateFormatted = '';
    try { dateFormatted = new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch {}

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${authorSafe} sur RESPEKTUS®</title>
<meta name="description" content="${descSafe}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${authorSafe} sur RESPEKTUS®">
<meta property="og:description" content="${descSafe}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="RESPEKTUS">
<meta property="og:locale" content="fr_FR">
${photoUrl && !isVideo ? `<meta property="og:image" content="${escapeHtml(photoUrl)}">` : ''}
<meta name="twitter:card" content="${photoUrl && !isVideo ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${authorSafe} sur RESPEKTUS®">
<meta name="twitter:description" content="${descSafe}">
${photoUrl && !isVideo ? `<meta name="twitter:image" content="${escapeHtml(photoUrl)}">` : ''}
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#FAF7F2;color:#1A1A1A;line-height:1.65}
.header{text-align:center;padding:32px 24px 22px;background:#FFF;border-bottom:1px solid #E8E0D5}
.brand{font-size:22px;font-weight:900;color:#2C5F3F;letter-spacing:4px;text-decoration:none}
.tagline{font-size:11px;color:#4A7C59;letter-spacing:1.5px;font-style:italic;margin-top:4px}
article{max-width:600px;margin:0 auto;padding:36px 24px 80px}
.author-row{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.avatar{width:46px;height:46px;border-radius:23px;background:#2C5F3F;color:#FFF;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.avatar img{width:100%;height:100%;border-radius:23px;object-fit:cover}
.author-info{flex:1}
.author-name{font-size:15px;font-weight:800;color:#1A1A1A}
.author-meta{font-size:11px;color:#8A8A8A;margin-top:2px}
.tag-badge{background:#EEF7F2;color:#2C5F3F;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:5px 11px;border-radius:8px}
.post-content{font-size:16px;color:#2C2C2C;line-height:1.7;margin-bottom:20px;white-space:pre-wrap}
.media{width:100%;border-radius:14px;margin:14px 0;background:#000;display:block;max-height:600px;object-fit:contain}
.video-placeholder{width:100%;aspect-ratio:9/16;max-height:480px;background:#1A1A1A;border-radius:14px;margin:14px 0;display:flex;align-items:center;justify-content:center;color:#FFF;font-weight:800}
.cta-section{background:#2C5F3F;border-radius:18px;padding:30px 24px;margin-top:30px;text-align:center;color:#FFF}
.cta-title{font-size:20px;font-weight:800;margin-bottom:8px}
.cta-sub{font-size:13px;color:#C0DEC9;margin-bottom:20px;line-height:1.6}
.cta-btn{display:inline-block;background:#FFF;color:#2C5F3F;text-decoration:none;font-weight:800;font-size:14px;padding:13px 24px;border-radius:12px;margin:5px}
.footer{text-align:center;padding:32px 24px;font-size:12px;color:#B0B0B0;border-top:1px solid #E8E0D5;background:#FFF}
.footer a{color:#2C5F3F;text-decoration:none}
@media(max-width:600px){.header{padding:22px 16px 16px}article{padding:24px 18px 60px}.post-content{font-size:15px}}
</style>
</head>
<body>

<div class="header">
  <a href="/" class="brand">RESPEKTUS®</a>
  <div class="tagline">Pour une beauté qui nous respecte</div>
</div>

<article>
  <div class="author-row">
    <div class="avatar">${post.author_photo ? `<img src="${escapeHtml(post.author_photo)}" alt="${authorSafe}">` : escapeHtml((post.author_initials || post.author_name || 'A').slice(0,2).toUpperCase())}</div>
    <div class="author-info">
      <div class="author-name">${authorSafe}</div>
      <div class="author-meta">${dateFormatted}</div>
    </div>
    <span class="tag-badge">${tagSafe}</span>
  </div>

  <div class="post-content">${contentSafe}</div>

  ${photoUrl ? (
    isVideo
      ? `<video class="media" controls playsinline preload="metadata"><source src="${escapeHtml(photoUrl)}" />Votre navigateur ne supporte pas la vidéo.</video>`
      : `<img class="media" src="${escapeHtml(photoUrl)}" alt="Publication de ${authorSafe}">`
  ) : ''}

  <div class="cta-section">
    <div class="cta-title">Rejoignez Le Cercle RESPEKTUS®</div>
    <div class="cta-sub">Téléchargez l'app pour réagir, commenter et découvrir les recettes d'aromathérapie scientifique.</div>
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
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    return res.status(200).send(html);
  } catch (e) {
    console.error('post-page error:', e);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(notFound(id, e.message));
  }
}
