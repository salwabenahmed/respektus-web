// Fonction serverless Vercel — envoie un email de palier atteint via Resend.
// Appelée par l'app RESPEKTUS quand un utilisateur franchit un palier de points
// (1000 / 2000 / 3000 / 5000) ou reçoit un cadeau de parrainage (palier=0).
//
// Sécurité :
// - Header X-App-Secret partagé (rejet si invalide)
// - Validation stricte des inputs (email, palier ∈ liste autorisée)
// - Vérification que l'email existe dans Airtable Fidelite (anti-spam externe)
// - Pas de retour d'info qui permettrait d'énumérer les utilisateurs

const ALLOWED_PALIERS = [0, 1000, 2000, 3000, 5000];
const FROM = 'Lia de RESPEKTUS <lia@respektus.com>';
const REPLY_TO = 'contact@respektus.com';
const SLOGAN = 'Respecte ta nature, r&eacute;v&egrave;le ta beaut&eacute;.';

function getFounderWord(gender) {
  if (gender === 'homme') return 'Fondateur';
  if (gender === 'femme') return 'Fondatrice';
  return 'Fondateur·rice';
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function buildHtml({ recompense, points }) {
  const pointsLine = points && Number(points) > 0
    ? `Bonne nouvelle. Tu viens d'atteindre le palier de <strong>${points} points</strong> sur RESPEKTUS et une r&eacute;compense t'attend.`
    : `Bonne nouvelle. Tu as d&eacute;bloqu&eacute; une r&eacute;compense exclusive RESPEKTUS.`;
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2C2C2C;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAF7F2;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E8E0D5;">
<tr><td style="padding:40px 32px 24px;text-align:center;background:#FAF7F2;border-bottom:1px solid #E8E0D5;">
<div style="font-size:24px;font-weight:900;color:#2C5F3F;letter-spacing:5px;">RESPEKTUS<sup style="font-size:12px;">&reg;</sup></div>
<div style="font-size:12px;color:#4A7C59;letter-spacing:1.5px;font-style:italic;margin-top:8px;">${SLOGAN}</div>
</td></tr>
<tr><td style="padding:36px 32px 8px;">
<h1 style="font-size:22px;font-weight:800;color:#1A1A1A;margin:0 0 20px;text-align:center;">Tu as d&eacute;bloqu&eacute; une r&eacute;compense</h1>
<p style="font-size:15px;line-height:1.7;color:#2C2C2C;margin:0 0 16px;">Bonjour,</p>
<p style="font-size:15px;line-height:1.7;color:#2C2C2C;margin:0 0 16px;">${pointsLine}</p>
</td></tr>
<tr><td style="padding:0 32px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF7F2;border:1px solid #C0DEC9;border-radius:14px;">
<tr><td style="padding:24px;text-align:center;">
<div style="font-size:11px;color:#4A7C59;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Ta r&eacute;compense</div>
<div style="font-size:22px;font-weight:800;color:#2C5F3F;margin-top:10px;">${escapeHtml(recompense)}</div>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:24px 32px 8px;">
<p style="font-size:15px;line-height:1.7;color:#2C2C2C;margin:0 0 16px;">C'est notre mani&egrave;re de te remercier pour ton engagement, tes contributions &agrave; la communaut&eacute; et la confiance que tu places dans notre d&eacute;marche.</p>
</td></tr>
<tr><td style="padding:0 32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAF7F2;border-radius:12px;">
<tr><td style="padding:20px 24px;">
<div style="font-size:12px;font-weight:700;color:#1A1A1A;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:12px;">Comment utiliser ton bon</div>
<div style="font-size:14px;color:#2C2C2C;line-height:1.7;">1. Ouvre l'application RESPEKTUS<br>2. Va dans ton Profil, puis Fid&eacute;lit&eacute; et Parrainage<br>3. Ton code Aroma-Zone te parviendra par email sous 48 heures</div>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:0 32px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFF8E6;border-left:3px solid #C8A96E;border-radius:0 8px 8px 0;">
<tr><td style="padding:14px 18px;">
<div style="font-size:13px;color:#6B6B6B;line-height:1.6;">Tes points sont valables 12 mois &agrave; compter de leur acquisition. Continue &agrave; les cumuler pour d&eacute;bloquer les paliers suivants.</div>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:24px 32px 32px;border-top:1px solid #E8E0D5;">
<p style="font-size:14px;color:#2C2C2C;font-weight:700;margin:0;">Lia, ta conseill&egrave;re beaut&eacute; naturelle</p>
<p style="font-size:13px;color:#6B6B6B;margin:4px 0 0;">L'&eacute;quipe RESPEKTUS</p>
</td></tr>
<tr><td style="padding:20px 32px;background:#FAF7F2;text-align:center;font-size:12px;color:#8A8A8A;border-top:1px solid #E8E0D5;">
RESPEKTUS<sup>&reg;</sup> &middot; <a href="mailto:contact@respektus.com" style="color:#2C5F3F;text-decoration:none;">contact@respektus.com</a><br>
<a href="https://www.respektus.com" style="color:#2C5F3F;text-decoration:none;">www.respektus.com</a> &middot; <a href="https://www.respektus.com/parrainage" style="color:#2C5F3F;text-decoration:none;">Fid&eacute;lit&eacute; et Parrainage</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildWelcomePremiumHtml({ name, planLabel }) {
  const greeting = name ? `Bonjour ${escapeHtml(name)},` : 'Bonjour,';
  const planLine = planLabel
    ? `Ton abonnement <strong>${escapeHtml(planLabel)}</strong> est maintenant actif.`
    : `Ton abonnement Premium est maintenant actif.`;
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2C2C2C;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAF7F2;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #E8E0D5;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
<tr><td style="padding:40px 32px 32px;text-align:center;background:linear-gradient(135deg,#162C22 0%,#1E3D2B 100%);">
  <div style="font-size:11px;letter-spacing:4px;font-weight:900;color:#C8A96E;margin-bottom:10px;">RESPEKTUS<sup style="font-size:8px;">&reg;</sup></div>
  <div style="display:inline-block;background:rgba(200,169,110,0.15);border:1px solid rgba(200,169,110,0.35);border-radius:20px;padding:6px 20px;margin-bottom:20px;">
    <span style="font-size:9px;font-weight:900;color:#C8A96E;letter-spacing:1.8px;text-transform:uppercase;">&#x2726; PREMIUM &#x2726;</span>
  </div>
  <div style="font-size:24px;font-weight:900;color:#FFFFFF;line-height:1.3;margin-bottom:10px;">Bienvenue parmi nous.</div>
  <div style="font-size:14px;color:#A8C5B0;line-height:1.6;font-style:italic;">${SLOGAN}</div>
</td></tr>
<tr><td style="padding:40px 36px 8px;">
  <p style="font-size:16px;line-height:1.7;color:#1A1A1A;margin:0 0 18px;font-weight:600;">${greeting}</p>
  <p style="font-size:15px;line-height:1.7;color:#2C2C2C;margin:0 0 16px;">Tu fais d&eacute;sormais partie des membres Premium RESPEKTUS. C'est bien plus qu'un abonnement : c'est un choix. Celui de respecter ta peau, ton corps et ta nature.</p>
  <p style="font-size:15px;line-height:1.7;color:#2C2C2C;margin:0 0 28px;">${planLine}</p>
</td></tr>
<tr><td style="padding:0 36px 28px;">
  <div style="background:#F5F0E8;border-radius:16px;padding:24px 28px;">
    <div style="font-size:10px;font-weight:900;color:#C8A96E;letter-spacing:2px;text-transform:uppercase;margin-bottom:18px;">Ce que tu d&eacute;bloques</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:8px 0;font-size:14px;color:#2C2C2C;line-height:1.5;border-bottom:1px solid #E8E0D5;"><span style="color:#2C5F3F;font-weight:800;margin-right:10px;">&#x2726;</span>Lia illimit&eacute;e, sans quota</td></tr>
      <tr><td style="padding:8px 0;font-size:14px;color:#2C2C2C;line-height:1.5;border-bottom:1px solid #E8E0D5;"><span style="color:#2C5F3F;font-weight:800;margin-right:10px;">&#x25C8;</span>Scanner INCI illimit&eacute;</td></tr>
      <tr><td style="padding:8px 0;font-size:14px;color:#2C2C2C;line-height:1.5;border-bottom:1px solid #E8E0D5;"><span style="color:#2C5F3F;font-weight:800;margin-right:10px;">&#x25C7;</span>Z&eacute;ro publicit&eacute;</td></tr>
      <tr><td style="padding:8px 0;font-size:14px;color:#2C2C2C;line-height:1.5;"><span style="color:#C8A96E;font-weight:800;margin-right:10px;">&#x2726;</span>Prix de lancement bloqu&eacute; &agrave; vie</td></tr>
    </table>
  </div>
</td></tr>
<tr><td style="padding:0 36px 32px;text-align:center;">
  <a href="https://apps.apple.com/app/id6771922081" style="display:inline-block;background:#2C5F3F;color:#FFFFFF;text-decoration:none;padding:16px 40px;border-radius:14px;font-size:15px;font-weight:800;letter-spacing:0.3px;">Ouvrir RESPEKTUS</a>
</td></tr>
<tr><td style="padding:24px 36px 36px;border-top:1px solid #E8E0D5;">
  <p style="font-size:15px;color:#1A1A1A;font-weight:800;margin:0;">Lia, ta conseill&egrave;re beaut&eacute; naturelle</p>
  <p style="font-size:13px;color:#6B6B6B;margin:4px 0 0;">L'&eacute;quipe RESPEKTUS</p>
</td></tr>
<tr><td style="padding:20px 32px;background:#F5F0E8;text-align:center;font-size:12px;color:#8A8A8A;border-top:1px solid #E8E0D5;">
  RESPEKTUS<sup>&reg;</sup> &middot; <a href="mailto:contact@respektus.com" style="color:#2C5F3F;text-decoration:none;">contact@respektus.com</a><br>
  <a href="https://www.respektus.com" style="color:#2C5F3F;text-decoration:none;">www.respektus.com</a><br><br>
  <span style="font-size:11px;color:#AAAAAA;">Pour g&eacute;rer ton abonnement, rends-toi dans R&eacute;glages &middot; Abonnements sur ton iPhone.</span>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

function buildWelcomeFounderHtml({ name, planLabel, gender }) {
  const founder = getFounderWord(gender);
  const founderUp = founder.toUpperCase().replace('·', '&middot;');
  const greeting = name ? `Bonjour ${escapeHtml(name)},` : 'Bonjour,';
  const planLine = planLabel
    ? `Ton abonnement <strong>${escapeHtml(planLabel)}</strong> est actif.`
    : `Ton abonnement Premium est actif.`;
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2C2C2C;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAF7F2;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #C8A96E;box-shadow:0 4px 32px rgba(200,169,110,0.18);">
<tr><td style="padding:40px 32px 32px;text-align:center;background:linear-gradient(135deg,#162C22 0%,#1E3D2B 100%);">
  <div style="font-size:11px;letter-spacing:4px;font-weight:900;color:#C8A96E;margin-bottom:10px;">RESPEKTUS<sup style="font-size:8px;">&reg;</sup></div>
  <div style="display:inline-block;background:rgba(200,169,110,0.15);border:1px solid rgba(200,169,110,0.5);border-radius:20px;padding:6px 20px;margin-bottom:20px;">
    <span style="font-size:9px;font-weight:900;color:#C8A96E;letter-spacing:1.8px;text-transform:uppercase;">&#x25C6; MEMBRE ${founderUp} &#x25C6;</span>
  </div>
  <div style="font-size:26px;font-weight:900;color:#FFFFFF;line-height:1.3;margin-bottom:10px;">F&eacute;licitations.</div>
  <div style="font-size:15px;color:#C8A96E;line-height:1.6;font-weight:700;">Tu fais partie des 1 000 premiers.</div>
</td></tr>
<tr><td style="padding:40px 36px 8px;">
  <p style="font-size:16px;line-height:1.7;color:#1A1A1A;margin:0 0 18px;font-weight:600;">${greeting}</p>
  <p style="font-size:15px;line-height:1.7;color:#2C2C2C;margin:0 0 16px;">Tu es parmi les rares personnes &agrave; avoir cru en RESPEKTUS d&egrave;s le d&eacute;but. Ce statut <strong>Membre ${escapeHtml(founder)}</strong> est d&eacute;finitif. Il reste visible sur ton profil et dans la communaut&eacute;, pour toujours.</p>
  <p style="font-size:15px;line-height:1.7;color:#2C2C2C;margin:0 0 28px;">${planLine}</p>
</td></tr>
<tr><td style="padding:0 36px 28px;">
  <div style="background:#FBF4E8;border:1.5px solid #C8A96E;border-radius:16px;padding:24px 28px;">
    <div style="font-size:10px;font-weight:900;color:#C8A96E;letter-spacing:2px;text-transform:uppercase;margin-bottom:18px;">Tes avantages exclusifs</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:8px 0;font-size:14px;color:#2C2C2C;line-height:1.5;border-bottom:1px solid #E8D9BE;"><span style="color:#C8A96E;font-weight:800;margin-right:10px;">&#x25C6;</span>Badge Membre ${escapeHtml(founder)} &agrave; vie sur ton profil</td></tr>
      <tr><td style="padding:8px 0;font-size:14px;color:#2C2C2C;line-height:1.5;border-bottom:1px solid #E8D9BE;"><span style="color:#C8A96E;font-weight:800;margin-right:10px;">&#x2726;</span>Lia illimit&eacute;e, sans quota</td></tr>
      <tr><td style="padding:8px 0;font-size:14px;color:#2C2C2C;line-height:1.5;border-bottom:1px solid #E8D9BE;"><span style="color:#C8A96E;font-weight:800;margin-right:10px;">&#x25C8;</span>Scanner INCI illimit&eacute;</td></tr>
      <tr><td style="padding:8px 0;font-size:14px;color:#2C2C2C;line-height:1.5;border-bottom:1px solid #E8D9BE;"><span style="color:#C8A96E;font-weight:800;margin-right:10px;">&#x25C7;</span>Z&eacute;ro publicit&eacute;</td></tr>
      <tr><td style="padding:8px 0;font-size:14px;color:#2C2C2C;line-height:1.5;"><span style="color:#C8A96E;font-weight:800;margin-right:10px;">&#x2665;</span>Prix de lancement bloqu&eacute; &agrave; vie</td></tr>
    </table>
  </div>
</td></tr>
<tr><td style="padding:24px 36px 8px;">
  <div style="background:#EEF7F2;border-left:3px solid #4A7C59;border-radius:0 12px 12px 0;padding:20px 22px;">
    <p style="font-size:14px;line-height:1.7;color:#2C2C2C;margin:0 0 10px;font-weight:700;">Partage RESPEKTUS autour de toi.</p>
    <p style="font-size:14px;line-height:1.7;color:#2C2C2C;margin:0;">En tant que Membre ${escapeHtml(founder)}, ta parole a du poids. Partage l'application &agrave; tes proches et aide-nous &agrave; grandir. Retrouve ton lien de parrainage dans Profil &gt; Fid&eacute;lit&eacute; et Parrainage.</p>
  </div>
</td></tr>
<tr><td style="padding:24px 36px 32px;text-align:center;">
  <a href="https://apps.apple.com/app/id6771922081" style="display:inline-block;background:linear-gradient(135deg,#C8A96E,#E8C88E);color:#1A1A1A;text-decoration:none;padding:16px 40px;border-radius:14px;font-size:15px;font-weight:900;letter-spacing:0.3px;">Ouvrir RESPEKTUS</a>
</td></tr>
<tr><td style="padding:24px 36px 36px;border-top:1px solid #E8E0D5;">
  <p style="font-size:15px;color:#1A1A1A;font-weight:800;margin:0;">Lia, ta conseill&egrave;re beaut&eacute; naturelle</p>
  <p style="font-size:13px;color:#6B6B6B;margin:4px 0 0;">L'&eacute;quipe RESPEKTUS</p>
</td></tr>
<tr><td style="padding:20px 32px;background:#F5F0E8;text-align:center;font-size:12px;color:#8A8A8A;border-top:1px solid #E8E0D5;">
  RESPEKTUS<sup>&reg;</sup> &middot; <a href="mailto:contact@respektus.com" style="color:#2C5F3F;text-decoration:none;">contact@respektus.com</a><br>
  <a href="https://www.respektus.com" style="color:#2C5F3F;text-decoration:none;">www.respektus.com</a>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Secret');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const provided = req.headers['x-app-secret'];
  if (!process.env.APP_SECRET || !provided || provided !== process.env.APP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Body required' });

  if (!isValidEmail(body.email)) return res.status(400).json({ error: 'Invalid email' });

  // Routage selon le type
  if (body.type === 'welcome_founder') {
    const founderWord = getFounderWord(body.gender);
    const html = buildWelcomeFounderHtml({ name: body.name, planLabel: body.planLabel, gender: body.gender });
    const subject = `Tu es Membre ${founderWord} RESPEKTUS`;
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: body.email, reply_to: REPLY_TO, subject, html }),
      });
      const d = await r.json();
      if (!r.ok) return res.status(502).json({ error: 'Email send failed' });
      return res.status(200).json({ ok: true, id: d.id });
    } catch (e) {
      return res.status(502).json({ error: 'Network error' });
    }
  }

  if (body.type === 'welcome_premium') {
    const html = buildWelcomePremiumHtml({ name: body.name, planLabel: body.planLabel });
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: body.email, reply_to: REPLY_TO, subject: 'Bienvenue dans RESPEKTUS Premium', html }),
      });
      const d = await r.json();
      if (!r.ok) return res.status(502).json({ error: 'Email send failed' });
      return res.status(200).json({ ok: true, id: d.id });
    } catch (e) {
      return res.status(502).json({ error: 'Network error' });
    }
  }

  // Email palier (comportement existant)
  const { email, recompense, points, palier } = body;
  if (!recompense || typeof recompense !== 'string' || recompense.length > 200) {
    return res.status(400).json({ error: 'Invalid recompense' });
  }
  if (!ALLOWED_PALIERS.includes(Number(palier))) {
    return res.status(400).json({ error: 'Invalid palier' });
  }
  if (points !== undefined && (typeof points !== 'number' || points < 0 || points > 1000000)) {
    return res.status(400).json({ error: 'Invalid points' });
  }

  try {
    const formula = encodeURIComponent(`LOWER({Email})="${email.toLowerCase()}"`);
    const atUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Fidelite?filterByFormula=${formula}&maxRecords=1`;
    const atRes = await fetch(atUrl, { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } });
    const atData = await atRes.json();
    if (!atData.records || atData.records.length === 0) return res.status(404).json({ error: 'Email not registered' });
  } catch (e) {
    console.error('Airtable check failed:', e?.message);
  }

  const html = buildHtml({ recompense, points });
  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: email, reply_to: REPLY_TO, subject: `Tu as débloqué : ${recompense}`, html }),
    });
    const resendData = await resendRes.json();
    if (!resendRes.ok) return res.status(502).json({ error: 'Email send failed', detail: resendData?.message });
    return res.status(200).json({ ok: true, id: resendData.id });
  } catch (e) {
    return res.status(502).json({ error: 'Network error' });
  }
}
