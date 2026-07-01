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
const ALLOWED_MODELS = new Set(['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-5-mini', 'gpt-5.5']);
const MODEL_REMAP = {};

// Renvoie { user } si OK, sinon { error, detail } pour diagnostic
async function verifyJwt(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'no_bearer', detail: 'Header Authorization absent ou mal formé' };
  }
  const jwt = authHeader.slice(7);
  if (!jwt || jwt === 'undefined' || jwt === 'null') {
    return { error: 'empty_jwt', detail: 'Token JWT vide' };
  }
  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL) return { error: 'missing_env', detail: 'EXPO_PUBLIC_SUPABASE_URL non définie côté serveur' };
  if (!ANON_KEY) return { error: 'missing_env', detail: 'EXPO_PUBLIC_SUPABASE_ANON_KEY non définie côté serveur' };
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${jwt}`, apikey: ANON_KEY },
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      return { error: 'supabase_rejected', detail: `Supabase /auth/v1/user → HTTP ${r.status} : ${txt.slice(0, 120)}` };
    }
    const data = await r.json();
    if (!data?.id) return { error: 'no_user_id', detail: 'Réponse Supabase sans user id' };
    return { user: { id: data.id, email: data.email } };
  } catch (e) {
    return { error: 'fetch_failed', detail: `Appel Supabase a planté : ${e?.message || 'erreur réseau'}` };
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
  const authResult = await verifyJwt(req.headers.authorization);
  if (authResult.error) {
    console.error('[openai-proxy] auth refused:', authResult.error, authResult.detail);
    return res.status(401).json({
      error: 'Authentification requise',
      reason: authResult.error,
      detail: authResult.detail,
    });
  }
  const user = authResult.user;

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
  const resolvedModel = MODEL_REMAP[model] || model;
  if (!ALLOWED_MODELS.has(resolvedModel)) {
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

  const streamMode = body?.stream === true;

  try {
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: resolvedModel,
        messages,
        max_tokens: safeMaxTokens,
        temperature: safeTemp,
        ...(streamMode ? { stream: true } : {}),
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

    if (streamMode) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');
      const reader = r.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } finally {
        reader.releaseLock();
        res.end();
      }
      return;
    }

    const data = await r.json();
    return res.status(200).json(data);
  } catch (e) {
    console.error('[openai-proxy] fetch error:', e?.message);
    return res.status(500).json({ error: 'Erreur réseau côté serveur' });
  }
}
