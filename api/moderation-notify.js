// Fonction serverless Vercel — notification email à la modératrice (Salwa)
// quand un nouveau post est mis en file (status='pending') ou qu'un signalement
// est créé. Appelée par les webhooks Supabase.
//
// Sécurité :
// - Header X-Webhook-Secret partagé avec Supabase
// - Idempotent : ré-envoyer le même payload ne génère pas de doublon notable

const FROM = 'Modération RESPEKTUS <lia@respektus.com>';
const REPLY_TO = 'contact@respektus.com';

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'dvwcbpekhsteyzwvxixs';
const SUPABASE_TABLE_URL = (table) => `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/editor?schema=public&table=${table}`;

function buildPendingPostEmail(post) {
  const author = escapeHtml(post.author_name || 'Anonyme');
  const username = post.author_username ? `@${escapeHtml(post.author_username)}` : '';
  const content = escapeHtml(post.content || '').replace(/\n/g, '<br>');
  const reason = escapeHtml(post.moderation_reason || 'L\'IA hésite, veuillez vérifier manuellement.');
  const tag = escapeHtml(post.tag || 'Partage');
  const supabaseLink = SUPABASE_TABLE_URL('community_posts');
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2C2C2C;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAF7F2;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E8E0D5;">

<tr><td style="padding:32px 28px 20px;background:#FFF8E6;border-bottom:1px solid #E8D9B0;">
<div style="font-size:11px;color:#C8A96E;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Modération RESPEKTUS</div>
<h1 style="font-size:20px;font-weight:800;color:#1A1A1A;margin:8px 0 0;">Nouveau post à vérifier</h1>
</td></tr>

<tr><td style="padding:24px 28px 8px;">
<div style="font-size:12px;color:#8A8A8A;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Auteur</div>
<div style="font-size:15px;color:#1A1A1A;font-weight:700;">${author} <span style="color:#8A8A8A;font-weight:400;">${username}</span></div>
</td></tr>

<tr><td style="padding:16px 28px 8px;">
<div style="font-size:12px;color:#8A8A8A;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Catégorie</div>
<div style="display:inline-block;background:#EEF7F2;color:#2C5F3F;font-size:12px;font-weight:700;padding:4px 10px;border-radius:6px;">${tag}</div>
</td></tr>

<tr><td style="padding:16px 28px 8px;">
<div style="font-size:12px;color:#8A8A8A;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Contenu</div>
<div style="font-size:14px;color:#2C2C2C;line-height:1.65;background:#FAF7F2;padding:16px;border-radius:10px;border-left:3px solid #2C5F3F;">${content}</div>
</td></tr>

<tr><td style="padding:16px 28px 24px;">
<div style="font-size:12px;color:#8A8A8A;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Motif de mise en attente (analyse IA)</div>
<div style="font-size:13px;color:#8A6620;background:#FFF4E0;padding:14px;border-radius:10px;border-left:3px solid #C8A96E;">${reason}</div>
</td></tr>

<tr><td style="padding:8px 28px 28px;text-align:center;">
<a href="${supabaseLink}" style="display:inline-block;background:#2C5F3F;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:12px;">Ouvrir Supabase pour modérer</a>
</td></tr>

<tr><td style="padding:0 28px 24px;">
<div style="font-size:12px;color:#8A8A8A;line-height:1.7;background:#FAF7F2;padding:14px;border-radius:10px;">
<strong style="color:#1A1A1A;">Comment modérer dans Supabase :</strong><br>
1. Filtrez la table community_posts sur status = pending<br>
2. Pour approuver : changez status à approved et moderated_at à la date du jour<br>
3. Pour refuser : changez status à rejected et remplissez moderation_reason
</div>
</td></tr>

<tr><td style="padding:20px 28px;background:#FAF7F2;border-top:1px solid #E8E0D5;text-align:center;">
<div style="font-size:11px;color:#A0A0A0;">Cet email est généré automatiquement par RESPEKTUS®<br>Charte du Cercle : <a href="https://www.respektus.com/charte" style="color:#2C5F3F;">respektus.com/charte</a></div>
</td></tr>

</table></td></tr></table></body></html>`;
}

function buildReportEmail(report) {
  const reason = escapeHtml(report.reason || 'Non précisé');
  const description = escapeHtml(report.description || '');
  const supabaseLink = SUPABASE_TABLE_URL('community_reports');
  const postLink = report.reported_post_id ? `${SUPABASE_TABLE_URL('community_posts')}&filter=id%3Aeq%3A${report.reported_post_id}` : supabaseLink;
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2C2C2C;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAF7F2;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E8E0D5;">

<tr><td style="padding:32px 28px 20px;background:#FFE9E0;border-bottom:1px solid #F5C8B4;">
<div style="font-size:11px;color:#C05030;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Signalement reçu</div>
<h1 style="font-size:20px;font-weight:800;color:#1A1A1A;margin:8px 0 0;">Une publication a été signalée</h1>
</td></tr>

<tr><td style="padding:24px 28px 8px;">
<div style="font-size:12px;color:#8A8A8A;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Motif</div>
<div style="font-size:15px;color:#1A1A1A;font-weight:700;">${reason}</div>
</td></tr>

${description ? `
<tr><td style="padding:16px 28px 8px;">
<div style="font-size:12px;color:#8A8A8A;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Détails</div>
<div style="font-size:14px;color:#2C2C2C;background:#FAF7F2;padding:14px;border-radius:10px;border-left:3px solid #C05030;">${description}</div>
</td></tr>
` : ''}

<tr><td style="padding:24px 28px 28px;text-align:center;">
<a href="${postLink}" style="display:inline-block;background:#2C5F3F;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:12px;">Examiner le post signalé</a>
</td></tr>

<tr><td style="padding:0 28px 24px;">
<div style="font-size:12px;color:#8A8A8A;line-height:1.7;background:#FAF7F2;padding:14px;border-radius:10px;">
<strong style="color:#1A1A1A;">À traiter sous 48h :</strong> ouvrez Supabase, retrouvez le post signalé. Si nécessaire, changez son status à rejected et remplissez moderation_reason. Bloquez l'utilisateur depuis community_blocks si le comportement est répété.
</div>
</td></tr>

<tr><td style="padding:20px 28px;background:#FAF7F2;border-top:1px solid #E8E0D5;text-align:center;">
<div style="font-size:11px;color:#A0A0A0;">Charte : <a href="https://www.respektus.com/charte" style="color:#2C5F3F;">respektus.com/charte</a></div>
</td></tr>

</table></td></tr></table></body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth — secret partagé avec Supabase
  const incomingSecret = req.headers['x-webhook-secret'] || req.headers['X-Webhook-Secret'];
  if (!incomingSecret || incomingSecret !== process.env.MODERATION_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); } }

  try {
    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_KEY) return res.status(500).json({ error: 'Resend not configured' });
    const TO = process.env.MODERATION_EMAIL_TO || 'ouladsalwa@gmail.com';

    let subject, html;
    if (body.table === 'community_posts' && body.record?.status === 'pending') {
      subject = 'RESPEKTUS — Nouveau post à vérifier';
      html = buildPendingPostEmail(body.record);
    } else if (body.table === 'community_reports') {
      subject = 'RESPEKTUS — Nouveau signalement reçu';
      html = buildReportEmail(body.record);
    } else {
      // Pas de notif à envoyer pour ce trigger
      return res.status(200).json({ ok: true, skipped: true });
    }

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: TO, reply_to: REPLY_TO, subject, html }),
    });
    const resendData = await resendResp.json();
    if (!resendResp.ok) {
      console.error('Resend error:', resendData);
      return res.status(502).json({ error: 'Resend failed', detail: resendData });
    }
    return res.status(200).json({ ok: true, id: resendData.id });
  } catch (e) {
    console.error('moderation-notify error:', e);
    return res.status(500).json({ error: 'Server error', message: e.message });
  }
}
