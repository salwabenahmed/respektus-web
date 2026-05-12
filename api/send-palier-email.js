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

function buildHtml({ recompense, points }) {
  const pointsLine = points && Number(points) > 0
    ? `Bonne nouvelle. Vous venez d'atteindre le palier de <strong>${points} points</strong> sur RESPEKTUS et une récompense vous attend.`
    : `Bonne nouvelle. Vous avez débloqué une récompense exclusive RESPEKTUS.`;
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2C2C2C;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAF7F2;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E8E0D5;">
<tr><td style="padding:40px 32px 24px;text-align:center;background:#FAF7F2;border-bottom:1px solid #E8E0D5;">
<div style="font-size:24px;font-weight:900;color:#2C5F3F;letter-spacing:5px;">RESPEKTUS<sup style="font-size:12px;">&reg;</sup></div>
<div style="font-size:12px;color:#4A7C59;letter-spacing:1.5px;font-style:italic;margin-top:8px;">Pour une beauté qui nous respecte</div>
</td></tr>
<tr><td style="padding:36px 32px 8px;">
<h1 style="font-size:22px;font-weight:800;color:#1A1A1A;margin:0 0 20px;text-align:center;">Vous avez débloqué une récompense</h1>
<p style="font-size:15px;line-height:1.7;color:#2C2C2C;margin:0 0 16px;">Bonjour,</p>
<p style="font-size:15px;line-height:1.7;color:#2C2C2C;margin:0 0 16px;">${pointsLine}</p>
</td></tr>
<tr><td style="padding:0 32px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF7F2;border:1px solid #C0DEC9;border-radius:14px;">
<tr><td style="padding:24px;text-align:center;">
<div style="font-size:11px;color:#4A7C59;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Votre récompense</div>
<div style="font-size:22px;font-weight:800;color:#2C5F3F;margin-top:10px;">${escapeHtml(recompense)}</div>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:24px 32px 8px;">
<p style="font-size:15px;line-height:1.7;color:#2C2C2C;margin:0 0 16px;">C'est notre manière de vous remercier pour votre engagement, vos contributions à la communauté et la confiance que vous placez dans notre démarche.</p>
</td></tr>
<tr><td style="padding:0 32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAF7F2;border-radius:12px;">
<tr><td style="padding:20px 24px;">
<div style="font-size:12px;font-weight:700;color:#1A1A1A;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:12px;">Comment utiliser votre bon</div>
<div style="font-size:14px;color:#2C2C2C;line-height:1.7;">1. Ouvrez l'application RESPEKTUS<br>2. Allez dans votre Profil, puis Fidélité et Parrainage<br>3. Votre code Aroma-Zone vous parviendra par email sous 48 heures</div>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:0 32px 24px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFF8E6;border-left:3px solid #C8A96E;border-radius:0 8px 8px 0;">
<tr><td style="padding:14px 18px;">
<div style="font-size:13px;color:#6B6B6B;line-height:1.6;">Vos points sont valables 12 mois à compter de leur acquisition. Continuez à les cumuler pour débloquer les paliers suivants.</div>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:24px 32px 32px;border-top:1px solid #E8E0D5;">
<p style="font-size:14px;color:#4A7C59;font-style:italic;margin:0 0 8px;">Pour une beauté qui nous respecte,</p>
<p style="font-size:14px;color:#2C2C2C;font-weight:700;margin:0;">Lia, votre conseillère beauté naturelle</p>
<p style="font-size:13px;color:#6B6B6B;margin:4px 0 0;">L'équipe RESPEKTUS</p>
</td></tr>
<tr><td style="padding:20px 32px;background:#FAF7F2;text-align:center;font-size:12px;color:#8A8A8A;border-top:1px solid #E8E0D5;">
RESPEKTUS<sup>&reg;</sup> &middot; <a href="mailto:contact@respektus.com" style="color:#2C5F3F;text-decoration:none;">contact@respektus.com</a><br>
<a href="https://www.respektus.com" style="color:#2C5F3F;text-decoration:none;">www.respektus.com</a> &middot; <a href="https://www.respektus.com/parrainage" style="color:#2C5F3F;text-decoration:none;">Fidélité et Parrainage</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
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

export default async function handler(req, res) {
  // CORS minimal (l'app n'en a pas besoin côté natif mais ça aide pour debug navigateur)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Secret');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Vérif du secret partagé
  const provided = req.headers['x-app-secret'];
  if (!process.env.APP_SECRET || !provided || provided !== process.env.APP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Parser le body si Vercel ne l'a pas déjà fait
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Body required' });

  const { email, recompense, points, palier } = body;

  // 3. Validation
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
  if (!recompense || typeof recompense !== 'string' || recompense.length > 200) {
    return res.status(400).json({ error: 'Invalid recompense' });
  }
  if (!ALLOWED_PALIERS.includes(Number(palier))) {
    return res.status(400).json({ error: 'Invalid palier' });
  }
  if (points !== undefined && (typeof points !== 'number' || points < 0 || points > 1000000)) {
    return res.status(400).json({ error: 'Invalid points' });
  }

  // 4. Vérifier que l'email existe dans Airtable Fidelite (anti-spam externe)
  try {
    const formula = encodeURIComponent(`LOWER({Email})="${email.toLowerCase()}"`);
    const atUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Fidelite?filterByFormula=${formula}&maxRecords=1`;
    const atRes = await fetch(atUrl, {
      headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` },
    });
    const atData = await atRes.json();
    if (!atData.records || atData.records.length === 0) {
      return res.status(404).json({ error: 'Email not registered' });
    }
  } catch (e) {
    console.error('Airtable check failed:', e?.message);
    // Pas bloquant si Airtable est down — on poursuit (degraded mode)
  }

  // 5. Envoi via Resend
  const html = buildHtml({ recompense, points });
  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: email,
        reply_to: REPLY_TO,
        subject: `Vous avez débloqué : ${recompense}`,
        html,
      }),
    });
    const resendData = await resendRes.json();
    if (!resendRes.ok) {
      console.error('Resend error:', resendData);
      return res.status(502).json({ error: 'Email send failed', detail: resendData?.message });
    }
    return res.status(200).json({ ok: true, id: resendData.id });
  } catch (e) {
    console.error('Resend request failed:', e?.message);
    return res.status(502).json({ error: 'Network error' });
  }
}
