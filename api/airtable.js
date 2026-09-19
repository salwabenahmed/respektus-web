// Proxy Airtable sécurisé — appelé par l'app RESPEKTUS®.
//
// Pourquoi : la clé Airtable était embarquée dans le bundle de l'app sous le préfixe
// EXPO_PUBLIC_, donc lisible en clair par quiconque téléchargeait l'app. Elle donnait un
// accès direct en lecture ET en écriture à la table Utilisateurs, qui contient les
// allergies, les traitements médicaux, les grossesses et les dates de naissance. Même
// schéma que /api/openai-proxy : la clé reste sur Vercel, l'app présente son JWT Supabase.
//
// Flux :
//   App ──[/api/airtable/<Table>?<query> + JWT Supabase]──> Vercel
//   Vercel vérifie le JWT, applique les règles ci-dessous, appelle Airtable
//
// Variables d'environnement requises sur Vercel :
//   AIRTABLE_API_KEY                → la VRAIE clé Airtable (pat…)
//   AIRTABLE_BASE_ID                → l'identifiant de base (app…)
//   EXPO_PUBLIC_SUPABASE_URL        → pour valider le JWT
//   EXPO_PUBLIC_SUPABASE_ANON_KEY   → idem

const AIRTABLE_URL = 'https://api.airtable.com/v0';
// Les pièces jointes passent par un hôte distinct chez Airtable.
const AIRTABLE_CONTENU_URL = 'https://content.airtable.com/v0';

// Tables atteignables, et à quelles conditions.
//
// `prive` : la table contient des données personnelles. Une personne connectée ne doit
// voir que ses propres lignes, sinon l'authentification ne fait que déplacer la fuite :
// il suffirait de créer un compte pour tout lire. On force donc le filtre sur son email
// en lecture, et on vérifie que la ligne visée lui appartient en écriture.
//
// `lectureSeule` : contenu éditorial, lisible par toute personne connectée, jamais
// modifiable depuis l'app.
const TABLES = {
  Utilisateurs: { prive: true, champEmail: 'Email' },
  Fidelite: { prive: true, champEmail: 'Email' },
  PointsLots: { prive: true, champEmail: 'Email' },
  Commandes: { prive: true, champEmail: 'Email' },
  Avis: { prive: true, champEmail: 'Email' },
  Quiz_Reponses: { prive: true, champEmail: 'Email' },
  Quiz: { lectureSeule: true },
  Blog: { lectureSeule: true },
  Config: { lectureSeule: true },
  Produits: { lectureSeule: true },
  Paliers: { lectureSeule: true },
};

async function verifierJwt(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { error: 'Authentification requise' };
  const jwt = authHeader.slice(7);
  if (!jwt || jwt === 'undefined' || jwt === 'null') return { error: 'Jeton vide' };

  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !ANON_KEY) return { error: 'Configuration serveur incomplète' };

  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${jwt}`, apikey: ANON_KEY },
    });
    if (!r.ok) return { error: 'Session invalide' };
    const data = await r.json();
    if (!data?.id) return { error: 'Session invalide' };
    return { user: { id: data.id, email: (data.email || '').toLowerCase() } };
  } catch {
    return { error: 'Vérification de session impossible' };
  }
}

const echapper = (v) => String(v).replace(/'/g, "\\'");

// Combine le filtre demandé par l'app et celui qu'on impose. Le filtre imposé gagne
// toujours : il est placé dans un AND dont l'app ne peut pas sortir.
function filtreRestreint(filtreDemande, champEmail, email) {
  const mien = `LOWER({${champEmail}})='${echapper(email)}'`;
  return filtreDemande ? `AND(${mien}, ${filtreDemande})` : mien;
}

// Vérifie qu'une fiche visée par une écriture appartient bien à la personne connectée.
async function ficheAutorisee(table, recordId, champEmail, email, headersAirtable, baseId) {
  try {
    const r = await fetch(`${AIRTABLE_URL}/${baseId}/${encodeURIComponent(table)}/${recordId}`, { headers: headersAirtable });
    if (!r.ok) return false;
    const fiche = await r.json();
    return String(fiche?.fields?.[champEmail] || '').toLowerCase() === email;
  } catch {
    return false;
  }
}

// L'envoi de pièce jointe ne nomme pas sa table : on cherche la fiche parmi les tables
// privées qui en acceptent, et on vérifie qu'elle appartient bien à l'appelant.
async function ficheAutoriseeParId(recordId, email, headersAirtable, baseId) {
  for (const [table, regle] of Object.entries(TABLES)) {
    if (!regle.prive) continue;
    if (await ficheAutorisee(table, recordId, regle.champEmail, email, headersAirtable, baseId)) return true;
  }
  return false;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;
  if (!AIRTABLE_API_KEY || !BASE_ID) {
    return res.status(500).json({ error: 'Proxy Airtable non configuré' });
  }

  const auth = await verifierJwt(req.headers.authorization);
  if (auth.error) return res.status(401).json({ error: auth.error });
  const { email } = auth.user;

  // Chemin appelé : /api/airtable/<Table>[/<recordId>]
  const segments = String(req.query.chemin || '')
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);
  const table = segments[0];
  const recordId = segments[1] || null;

  const estPieceJointe = segments.length >= 3 && segments[segments.length - 1] === 'uploadAttachment';
  const regle = estPieceJointe ? { prive: true, champEmail: 'Email' } : TABLES[table];
  if (!regle) return res.status(403).json({ error: 'Table non autorisée' });

  const ecriture = req.method !== 'GET';
  if (ecriture && regle.lectureSeule) {
    return res.status(403).json({ error: 'Table en lecture seule' });
  }
  if (regle.prive && !email) {
    return res.status(403).json({ error: 'Compte sans email, accès refusé' });
  }

  const headersAirtable = {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  };

  // Une écriture nominative (PATCH/DELETE sur une fiche) n'est permise que sur ses
  // propres lignes. Sans ce contrôle, n'importe quel compte pourrait s'attribuer le
  // statut Premium ou vider les points de quelqu'un d'autre.
  if (regle.prive && ecriture && recordId && !estPieceJointe) {
    const ok = await ficheAutorisee(table, recordId, regle.champEmail, email, headersAirtable, BASE_ID);
    if (!ok) return res.status(403).json({ error: 'Cette fiche ne vous appartient pas' });
  }

  // Une création dans une table privée est forcée à son propre email.
  let corps = req.body;
  if (regle.prive && req.method === 'POST' && !estPieceJointe && corps?.fields) {
    corps = { ...corps, fields: { ...corps.fields, [regle.champEmail]: email } };
  }

  // Reconstruction de la requête : on reprend les paramètres de l'app, sauf le filtre
  // des tables privées qu'on remplace par sa version restreinte.
  const params = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(req.query)) {
    if (cle === 'chemin') continue;
    if (Array.isArray(valeur)) valeur.forEach((v) => params.append(cle, v));
    else params.append(cle, valeur);
  }
  if (regle.prive && req.method === 'GET') {
    params.set('filterByFormula', filtreRestreint(params.get('filterByFormula'), regle.champEmail, email));
  }

  // Envoi de pièce jointe : /api/airtable/<recordId>/<Champ>/uploadAttachment, sur
  // l'hôte de contenu d'Airtable. La fiche visée doit appartenir à la personne connectée.
  const piece = segments.length >= 3 && segments[segments.length - 1] === 'uploadAttachment';
  if (piece) {
    const fiche = segments[0];
    const champ = segments[1];
    const proprietaire = await ficheAutoriseeParId(fiche, email, headersAirtable, BASE_ID);
    if (!proprietaire) return res.status(403).json({ error: 'Cette fiche ne vous appartient pas' });
    try {
      const r = await fetch(`${AIRTABLE_CONTENU_URL}/${BASE_ID}/${fiche}/${encodeURIComponent(champ)}/uploadAttachment`, {
        method: 'POST', headers: headersAirtable, body: JSON.stringify(req.body || {}),
      });
      const t = await r.text();
      res.status(r.status); res.setHeader('Content-Type', 'application/json');
      return res.send(t || '{}');
    } catch {
      return res.status(502).json({ error: 'Airtable injoignable' });
    }
  }

  const url = `${AIRTABLE_URL}/${BASE_ID}/${encodeURIComponent(table)}${recordId ? `/${recordId}` : ''}${params.toString() ? `?${params}` : ''}`;

  try {
    const reponse = await fetch(url, {
      method: req.method,
      headers: headersAirtable,
      body: ecriture && corps ? JSON.stringify(corps) : undefined,
    });
    const texte = await reponse.text();
    res.status(reponse.status);
    res.setHeader('Content-Type', 'application/json');
    return res.send(texte || '{}');
  } catch (e) {
    console.error('[airtable-proxy]', e?.message);
    return res.status(502).json({ error: 'Airtable injoignable' });
  }
}
