// Fonction serverless qui retourne un aperçu Open Graph pour une URL donnée.
// Appelée par l'app quand un post contient un lien, pour afficher une carte miniature.
//
// Sécurité :
// - Secret partagé X-App-Secret
// - Validation stricte de l'URL (http/https uniquement, format valide)
// - Timeout de 5s pour ne pas bloquer si le site cible est lent
// - User-Agent identifiable pour respecter la nétiquette

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Secret');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Authentification
  const provided = req.headers['x-app-secret'];
  if (!process.env.APP_SECRET || !provided || provided !== process.env.APP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. Parse body
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  if (!body || typeof body.url !== 'string') {
    return res.status(400).json({ error: 'URL required' });
  }

  // 3. Normaliser et valider l'URL
  let url = body.url.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only http/https allowed' });
  }

  // 3bis. Cas spéciaux : APIs oEmbed officielles (résultat plus fiable que le scraping)
  const host = parsed.hostname.replace(/^www\./, '');
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com') {
    const oembed = await tryOEmbed(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (oembed) {
      return res.status(200).json({
        url,
        title: String(oembed.title || '').slice(0, 200),
        description: oembed.author_name ? `Par ${oembed.author_name}` : '',
        image: String(oembed.thumbnail_url || '').slice(0, 500),
        siteName: 'YouTube',
      });
    }
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const oembed = await tryOEmbed(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
    if (oembed) {
      return res.status(200).json({
        url,
        title: String(oembed.title || '').slice(0, 200),
        description: oembed.author_name ? `Par ${oembed.author_name}` : '',
        image: String(oembed.thumbnail_url || '').slice(0, 500),
        siteName: 'Vimeo',
      });
    }
  }

  // 4. Fetch du site cible avec timeout (User-Agent réaliste pour éviter les blocages anti-bot)
  let html;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    clearTimeout(t);
    if (!r.ok) return res.status(200).json({ url, title: '', description: '', image: '', siteName: parsed.hostname });
    // Limiter la taille lue à 500 Ko pour éviter d'engloutir un gros fichier
    const reader = r.body?.getReader?.();
    if (reader) {
      const decoder = new TextDecoder();
      let total = 0;
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        chunks.push(decoder.decode(value, { stream: true }));
        if (total > 500_000) break;
      }
      html = chunks.join('');
    } else {
      html = await r.text();
    }
  } catch (e) {
    return res.status(200).json({ url, title: '', description: '', image: '', siteName: parsed.hostname });
  }

  // 5. Extraire les meta tags Open Graph
  const meta = (name) => {
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, 'i'),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m) return decodeEntities(m[1]);
    }
    return null;
  };

  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = meta('og:title') || meta('twitter:title') || (titleTag ? decodeEntities(titleTag[1]) : '') || '';
  const description = meta('og:description') || meta('twitter:description') || meta('description') || '';
  let image = meta('og:image') || meta('twitter:image') || meta('twitter:image:src') || '';
  if (image && !/^https?:\/\//i.test(image)) {
    try { image = new URL(image, url).toString(); } catch { image = ''; }
  }
  const siteName = meta('og:site_name') || parsed.hostname;

  return res.status(200).json({
    url,
    title: String(title).trim().slice(0, 200),
    description: String(description).trim().slice(0, 300),
    image: String(image).trim().slice(0, 500),
    siteName: String(siteName).trim().slice(0, 100),
  });
}

async function tryOEmbed(endpoint) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(endpoint, {
      headers: { 'User-Agent': 'Mozilla/5.0 RESPEKTUS-LinkPreview/1.0' },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function decodeEntities(s = '') {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}
