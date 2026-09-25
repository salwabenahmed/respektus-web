// Administration du gate de mise à jour forcée — table Airtable "AppConfig".
//
// L'app compare sa version à min_ios_version / min_android_version au démarrage et
// bloque sur un écran « mets à jour » si elle est en dessous. Cet endpoint permet de
// pousser ces valeurs sans ouvrir Airtable, protégé par le secret d'administration.
//
//   POST /api/config-version?secret=...&ios=1.7.0&android=1.7.0
//   (un seul des deux paramètres suffit ; GET renvoie les valeurs actuelles)

export const maxDuration = 30;

const AIRTABLE_URL = 'https://api.airtable.com/v0';
const CLES = { ios: 'min_ios_version', android: 'min_android_version' };

// Ne jamais bloquer les utilisateurs sur une valeur mal tapée : version X.Y.Z stricte.
const VERSION_RE = /^\d+\.\d+\.\d+$/;

export default async function handler(req, res) {
  const secret = req.query?.secret || '';
  if (!process.env.AUDIT_SECRET || secret !== process.env.AUDIT_SECRET) {
    return res.status(401).json({ error: 'non autorisé' });
  }
  const base = process.env.AIRTABLE_BASE_ID;
  const headers = { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`, 'Content-Type': 'application/json' };

  try {
    const r = await fetch(`${AIRTABLE_URL}/${base}/AppConfig`, { headers });
    const d = await r.json();
    if (!r.ok) throw new Error(`Airtable ${r.status}`);
    const parCle = {};
    for (const rec of d.records || []) parCle[rec.fields?.['Clé']] = rec;

    const resultat = {};
    if (req.method === 'POST') {
      for (const [param, cle] of Object.entries(CLES)) {
        const valeur = req.query?.[param];
        if (!valeur) continue;
        if (!VERSION_RE.test(valeur)) return res.status(400).json({ error: `version invalide pour ${param}: ${valeur}` });
        const rec = parCle[cle];
        if (!rec) return res.status(404).json({ error: `clé ${cle} introuvable dans AppConfig` });
        const patch = await fetch(`${AIRTABLE_URL}/${base}/AppConfig/${rec.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ fields: { Valeur: valeur } }),
        });
        if (!patch.ok) throw new Error(`Airtable PATCH ${patch.status}`);
        resultat[cle] = valeur;
      }
    }

    const relu = await fetch(`${AIRTABLE_URL}/${base}/AppConfig`, { headers });
    const d2 = await relu.json();
    const actuel = {};
    for (const rec of d2.records || []) actuel[rec.fields?.['Clé']] = rec.fields?.Valeur;
    return res.status(200).json({ modifie: resultat, actuel });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
