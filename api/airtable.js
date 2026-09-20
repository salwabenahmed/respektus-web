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
//   SUPABASE_SERVICE_ROLE_KEY       → pour la fenêtre d'inscription (voir plus bas)

export const maxDuration = 30;

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
// `lectureSeule` : contenu éditorial, sans aucune donnée personnelle. Lisible sans
// session, parce que c'est déjà publié sur le site : exiger une session n'apporterait
// aucune protection et rendrait l'app dépendante d'une connexion pour afficher un article
// de blog ou la question du jour. Jamais modifiable depuis l'app.
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

// Fenêtre d'inscription.
//
// La confirmation d'email est exigée sur ce projet Supabase : juste après la création du
// compte, l'app n'a donc PAS encore de session. Or c'est précisément le moment où la
// fiche Utilisateurs doit être écrite, sans quoi la personne n'existe nulle part.
//
// On accepte donc une seconde preuve : l'app annonce l'identifiant du compte qu'elle
// vient de créer, et le serveur vérifie auprès de Supabase que ce compte existe, que
// l'email correspond, et qu'il a été créé il y a moins de trente minutes. Sans cette
// fenêtre, il faudrait soit laisser la table ouverte, soit perdre l'inscription.
const FENETRE_INSCRIPTION_MS = 30 * 60 * 1000;

async function verifierInscriptionRecente(userId, email) {
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!SERVICE || !SUPABASE_URL || !userId || !email) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE },
    });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u?.id) return null;
    if (String(u.email || '').toLowerCase() !== String(email).toLowerCase()) return null;
    const age = Date.now() - new Date(u.created_at).getTime();
    if (!Number.isFinite(age) || age > FENETRE_INSCRIPTION_MS) return null;
    return { id: u.id, email: String(u.email).toLowerCase() };
  } catch {
    return null;
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

const entetesAirtable = (cle) => ({
  Authorization: `Bearer ${cle}`,
  'Content-Type': 'application/json',
});

function construireUrl(baseId, table, recordId, query, champEmail, email) {
  const params = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(query || {})) {
    if (cle === 'chemin') continue;
    if (Array.isArray(valeur)) valeur.forEach((v) => params.append(cle, v));
    else params.append(cle, valeur);
  }
  if (champEmail && email) {
    params.set('filterByFormula', filtreRestreint(params.get('filterByFormula'), champEmail, email));
  }
  return `${AIRTABLE_URL}/${baseId}/${encodeURIComponent(table)}${recordId ? `/${recordId}` : ''}${params.toString() ? `?${params}` : ''}`;
}

async function relayer(req, res, { url, headers, corps }) {
  try {
    const reponse = await fetch(url, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && corps ? JSON.stringify(corps) : undefined,
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Inscription-User, X-Inscription-Email');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;
  if (!AIRTABLE_API_KEY || !BASE_ID) {
    return res.status(500).json({ error: 'Proxy Airtable non configuré' });
  }

  // Chemin appelé : /api/airtable/<Table>[/<recordId>]
  const segments = String(req.query.chemin || '')
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);
  const table = segments[0];
  const recordId = segments[1] || null;

  // Contenu éditorial en lecture : aucune identité requise, ces tables ne contiennent
  // aucune donnée personnelle et sont déjà publiées sur le site.
  if (req.method === 'GET' && TABLES[table]?.lectureSeule) {
    return relayer(req, res, {
      url: construireUrl(BASE_ID, table, null, req.query, null, null),
      headers: entetesAirtable(AIRTABLE_API_KEY),
    });
  }

  let identite = null;
  const auth = await verifierJwt(req.headers.authorization);
  if (!auth.error) {
    identite = auth.user;
  } else {
    // Pas de session : on tente la fenêtre d'inscription avant de refuser.
    identite = await verifierInscriptionRecente(
      req.headers['x-inscription-user'],
      req.headers['x-inscription-email']
    );
  }
  if (!identite) return res.status(401).json({ error: auth.error || 'Authentification requise' });
  const { email } = identite;

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

  // Envoi de pièce jointe : /api/airtable/<recordId>/<Champ>/uploadAttachment, sur l'hôte
  // de contenu d'Airtable. La fiche visée doit appartenir à la personne connectée.
  if (estPieceJointe) {
    const fiche = segments[0];
    const champ = segments[1];
    const proprietaire = await ficheAutoriseeParId(fiche, email, headersAirtable, BASE_ID);
    if (!proprietaire) return res.status(403).json({ error: 'Cette fiche ne vous appartient pas' });
    return relayer(req, res, {
      url: `${AIRTABLE_CONTENU_URL}/${BASE_ID}/${fiche}/${encodeURIComponent(champ)}/uploadAttachment`,
      headers: headersAirtable,
      corps: req.body || {},
    });
  }

  return relayer(req, res, {
    url: construireUrl(BASE_ID, table, recordId, req.query, regle.prive && req.method === 'GET' ? regle.champEmail : null, email),
    headers: headersAirtable,
    corps,
  });
}
