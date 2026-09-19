// Routeur des pages publiques rendues côté serveur.
//
// Le forfait Vercel plafonne à douze fonctions. Ces quatre rendus de page partageaient
// déjà la même forme (un identifiant en paramètre, du HTML en retour) : les réunir sous
// une seule fonction libère trois emplacements, sans changer aucune URL publique ni le
// contenu servi.

const RENDUS = {
  actif: () => import('./_actif-page.js'),
  recette: () => import('./_recette-page.js'),
  blog: () => import('./_blog-page.js'),
  post: () => import('./_post-page.js'),
};

export default async function handler(req, res) {
  const type = req.query?.type;
  const charger = RENDUS[type];
  if (!charger) return res.status(404).send('Page introuvable');
  const mod = await charger();
  return (mod.default || mod)(req, res);
}
