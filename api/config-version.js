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

// Version réellement disponible sur l'App Store (null si la fiche est injoignable, on ne
// bloque alors pas l'opération : mieux vaut laisser passer qu'empêcher une correction).
async function versionSurAppStore() {
  try {
    const r = await fetch('https://itunes.apple.com/lookup?id=6771922081&country=fr', { signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    return d?.results?.[0]?.version || null;
  } catch {
    return null;
  }
}

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
        // Exiger une version absente du store enferme tout le monde dehors : l'app réclame
        // une mise à jour que le store ne propose pas, et il ne reste qu'à désinstaller.
        // On vérifie donc que la version demandée est bien en ligne avant de l'imposer.
        if (param === 'ios' && req.query?.force !== '1') {
          const enLigne = await versionSurAppStore();
          if (enLigne && enLigne !== valeur) {
            return res.status(409).json({
              error: `l'App Store propose la version ${enLigne}, pas ${valeur} — forcer ${valeur} bloquerait tout le monde sans issue`,
              astuce: 'relancer avec &force=1 seulement si la publication vient d\'être validée',
            });
          }
        }
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
