// Proxy OpenAI sécurisé — appelé par l'app RESPEKTUS®.
//
// Pourquoi : la clé OpenAI ne doit JAMAIS être incluse dans le bundle de l'app
// (sinon n'importe qui peut la décompiler et l'utiliser). Cette fonction
// serverless garde la clé côté serveur Vercel et fait l'intermédiaire.
//
// Flux :
//   App ──[POST {prompt,system,messages,model,…} + JWT Supabase]──> /api/openai-proxy
//   Vercel vérifie le JWT, appelle OpenAI avec OPENAI_API_KEY (env serveur)
//   Vercel renvoie la réponse OpenAI à l'app
//
// Variables d'environnement requises sur Vercel :
//   OPENAI_API_KEY                  → la VRAIE clé OpenAI (sk-proj-…)
//   EXPO_PUBLIC_SUPABASE_URL        → pour valider le JWT
//   EXPO_PUBLIC_SUPABASE_ANON_KEY   → idem

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

// Limites de garde-fou (en plus du plafond OpenAI lui-même)
const MAX_TOKENS_CAP = 1600;        // jamais plus de 1600 tokens de sortie
const ALLOWED_MODELS = new Set(['gpt-4o', 'gpt-4o-mini']);

async function verifyJwt(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const jwt = authHeader.slice(7);
  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !ANON_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${jwt}`, apikey: ANON_KEY },
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data?.id ? { id: data.id, email: data.email } : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  // CORS (web client de l'app peut appeler depuis n'importe quel domaine Expo)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ─── Auth obligatoire ────────────────────────────────────────────────────
  const user = await verifyJwt(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Authentification requise' });

  // ─── Validation du body ──────────────────────────────────────────────────
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const {
    messages,
    model = 'gpt-4o',
    max_tokens = 1400,
    temperature = 0.3,
    response_format,
  } = body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Le champ messages est requis' });
  }
  if (!ALLOWED_MODELS.has(model)) {
    return res.status(400).json({ error: `Modèle non autorisé. Autorisés : ${[...ALLOWED_MODELS].join(', ')}` });
  }
  const safeMaxTokens = Math.min(Math.max(50, Number(max_tokens) || 1400), MAX_TOKENS_CAP);
  const safeTemp = Math.min(Math.max(0, Number(temperature) || 0.3), 1.0);

  // ─── Appel OpenAI ────────────────────────────────────────────────────────
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[openai-proxy] OPENAI_API_KEY manquante côté serveur');
    return res.status(500).json({ error: 'Configuration serveur invalide' });
  }

  try {
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: safeMaxTokens,
        temperature: safeTemp,
        // Pass-through optionnel : autorise uniquement le format JSON OpenAI
        ...(response_format && response_format.type === 'json_object'
          ? { response_format: { type: 'json_object' } }
          : {}),
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      console.error('[openai-proxy] OpenAI HTTP', r.status, errText.slice(0, 200));
      return res.status(r.status).json({ error: 'Erreur OpenAI', detail: errText.slice(0, 200) });
    }
    const data = await r.json();
    // On renvoie tel quel pour que l'app n'ait pas à changer de format
    return res.status(200).json(data);
  } catch (e) {
    console.error('[openai-proxy] fetch error:', e?.message);
    return res.status(500).json({ error: 'Erreur réseau côté serveur' });
  }
}
