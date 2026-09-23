// Audit Supabase ↔ Airtable — réservé à l'administration.
//
// Le compte Supabase naît dès l'inscription ; la fiche Airtable "Utilisateurs" n'est
// écrite que pendant l'onboarding via le proxy. Email jamais confirmé, onboarding
// abandonné ou écriture échouée : le compte existe alors côté Supabase sans fiche
// Airtable. Cet endpoint mesure l'écart, et sait le combler (fiches minimales) sur
// demande explicite.
//
//   GET  /api/audit-utilisateurs?secret=...          → rapport (aucune écriture)
//   POST /api/audit-utilisateurs?secret=...&fix=1    → crée les fiches manquantes
//        (uniquement pour les comptes dont l'email est confirmé)
//
// Le secret vit dans la variable d'environnement AUDIT_SECRET sur Vercel.

export const maxDuration = 60;

const AIRTABLE_URL = 'https://api.airtable.com/v0';

async function listeEmailsAirtable(cle, base) {
  const emails = new Set();
  let offset = '';
  do {
    const url = `${AIRTABLE_URL}/${base}/Utilisateurs?fields%5B%5D=Email&pageSize=100${offset ? `&offset=${offset}` : ''}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${cle}` } });
    const d = await r.json();
    if (!r.ok) throw new Error(`Airtable ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
    for (const rec of d.records || []) {
      const e = (rec.fields?.Email || '').trim().toLowerCase();
      if (e) emails.add(e);
    }
    offset = d.offset || '';
  } while (offset);
  return emails;
}

async function listeComptesSupabase(url, serviceKey) {
  const comptes = [];
  let page = 1;
  for (;;) {
    const r = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=100`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const d = await r.json();
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
    const users = d.users || [];
    comptes.push(...users);
    if (users.length < 100) break;
    page += 1;
  }
  return comptes;
}

export default async function handler(req, res) {
  const secret = req.query?.secret || '';
  if (!process.env.AUDIT_SECRET || secret !== process.env.AUDIT_SECRET) {
    return res.status(401).json({ error: 'non autorisé' });
  }

  try {
    const [emailsAirtable, comptes] = await Promise.all([
      listeEmailsAirtable(process.env.AIRTABLE_API_KEY, process.env.AIRTABLE_BASE_ID),
      listeComptesSupabase(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY),
    ]);

    const manquants = comptes
      .filter((u) => u.email && !emailsAirtable.has(u.email.trim().toLowerCase()))
      .map((u) => ({
        email: u.email.toLowerCase(),
        prenom: u.user_metadata?.first_name || u.user_metadata?.full_name || '',
        confirme: !!u.email_confirmed_at,
        cree_le: (u.created_at || '').slice(0, 10),
      }));

    const rapport = {
      supabase: comptes.length,
      airtable: emailsAirtable.size,
      manquants_total: manquants.length,
      manquants_confirmes: manquants.filter((m) => m.confirme).length,
      manquants: manquants.sort((a, b) => (a.cree_le < b.cree_le ? 1 : -1)),
    };

    if (req.method === 'POST' && req.query?.fix === '1') {
      const aCreer = manquants.filter((m) => m.confirme);
      let crees = 0;
      // Airtable accepte 10 lignes par requête.
      for (let i = 0; i < aCreer.length; i += 10) {
        const lot = aCreer.slice(i, i + 10).map((m) => ({
          fields: { Email: m.email, ...(m.prenom ? { Prenom: m.prenom } : {}), ...(m.cree_le ? { Date: m.cree_le } : {}) },
        }));
        const r = await fetch(`${AIRTABLE_URL}/${process.env.AIRTABLE_BASE_ID}/Utilisateurs`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: lot }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(`Airtable création ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
        crees += (d.records || []).length;
      }
      rapport.fiches_creees = crees;
    }

    return res.status(200).json(rapport);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
