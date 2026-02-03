const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...init.headers },
    ...init
  });

const text = (data, init = {}) =>
  new Response(data, {
    headers: { 'Content-Type': 'text/plain', ...init.headers },
    ...init
  });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const encoder = new TextEncoder();

function parseStores(env) {
  try {
    const stores = JSON.parse(env.STORES_JSON || '[]');
    if (Array.isArray(stores)) return stores;
  } catch (err) {
    return [];
  }
  return [];
}

async function hashEndpoint(endpoint) {
  const data = encoder.encode(endpoint);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function base64UrlEncode(bytes) {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(str.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function createVapidJwt(audience, publicKey, privateKey) {
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const payload = base64UrlEncode(
    encoder.encode(JSON.stringify({ aud: audience, exp, sub: 'mailto:alerts@example.com' }))
  );
  const token = `${header}.${payload}`;

  const publicBytes = base64UrlDecode(publicKey);
  const x = base64UrlEncode(publicBytes.slice(1, 33));
  const y = base64UrlEncode(publicBytes.slice(33, 65));
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x,
    y,
    d: privateKey
  };

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(token)
  );

  const signatureBase64 = base64UrlEncode(new Uint8Array(signature));
  return `${token}.${signatureBase64}`;
}

function matchesKeywords(offer, keywords) {
  if (!keywords || keywords.length === 0) return false;
  const title = offer?.title || offer?.name || '';
  const description = offer?.description || offer?.shortDescription || '';
  const textValue = `${title} ${description}`.toLowerCase();
  return keywords.some((keyword) => textValue.includes(keyword.toLowerCase()));
}

const MAX_PAGES = 20;

async function fetchOffersPage({ storeId, languageCode, size, page, query }, env) {
  const params = new URLSearchParams({
    languageCode: languageCode || 'pl',
    size: size || '32',
    storeIds: storeId,
    page: page || '0'
  });
  if (query) params.set('query', query);
  const url = `${env.IKEA_API_BASE}/offers/grouped/search?${params}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });
  if (!res.ok) throw new Error(`IKEA API error: ${res.status}`);
  return res.json();
}

async function fetchOffers({ storeIds, languageCode, size, query }, env, { allPages = false } = {}) {
  const first = await fetchOffersPage({ storeId: storeIds, languageCode, size, page: '0', query }, env);
  if (!allPages) return first;

  const totalPages = Math.min(first?.totalPages || 1, MAX_PAGES);
  if (totalPages <= 1) return first;

  const merged = {
    ...first,
    content: Array.isArray(first.content) ? [...first.content] : []
  };

  for (let page = 1; page < totalPages; page += 1) {
    const next = await fetchOffersPage({ storeId: storeIds, languageCode, size, page: String(page), query }, env);
    if (Array.isArray(next?.content)) merged.content.push(...next.content);
  }

  merged.numberOfElements = merged.content.length;
  return merged;
}

function extractOffers(payload) {
  if (!payload) return [];
  if (Array.isArray(payload.content)) return payload.content;
  if (Array.isArray(payload.offers)) return payload.offers;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.groupedOffers)) return payload.groupedOffers;
  if (Array.isArray(payload.groups)) {
    const grouped = payload.groups.flatMap((group) => group?.offers || []);
    if (grouped.length > 0) return grouped;
  }
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

async function handleItems(request, env) {
  const { searchParams } = new URL(request.url);
  const storeIds = searchParams.get('storeIds');
  if (!storeIds) return json({ error: 'Missing storeIds' }, { status: 400, headers: corsHeaders });

  const payload = await fetchOffers(
    {
      storeIds,
      languageCode: searchParams.get('languageCode') || 'pl',
      size: searchParams.get('size') || '32',
      query: searchParams.get('query') || undefined
    },
    env,
    { allPages: searchParams.get('allPages') === '1' }
  );

  return json(payload, { headers: corsHeaders });
}

async function handleSubscribe(request, env) {
  const body = await request.json();
  const { subscription, keywords, storeIds } = body || {};

  if (!subscription?.endpoint || !storeIds || storeIds.length === 0) {
    return json({ error: 'Missing subscription or storeId' }, { status: 400, headers: corsHeaders });
  }

  const key = await hashEndpoint(subscription.endpoint);
  const record = {
    endpoint: subscription.endpoint,
    subscription,
    keywords: Array.isArray(keywords) ? keywords : [],
    storeIds: Array.isArray(storeIds) ? storeIds : [storeIds],
    lastSeenIds: []
  };

  await env.SUBSCRIPTIONS.put(`sub:${key}`, JSON.stringify(record));
  return json({ ok: true }, { headers: corsHeaders });
}

async function handleUnsubscribe(request, env) {
  const body = await request.json();
  const { endpoint } = body || {};
  if (!endpoint) return json({ error: 'Missing endpoint' }, { status: 400, headers: corsHeaders });

  const key = await hashEndpoint(endpoint);
  await env.SUBSCRIPTIONS.delete(`sub:${key}`);
  return json({ ok: true }, { headers: corsHeaders });
}

async function handleTestNotification(request, env) {
  const body = await request.json();
  const { endpoint } = body || {};
  if (!endpoint) return json({ error: 'Missing endpoint' }, { status: 400, headers: corsHeaders });

  const key = await hashEndpoint(endpoint);
  const raw = await env.SUBSCRIPTIONS.get(`sub:${key}`);
  if (!raw) return json({ error: 'Subscription not found' }, { status: 404, headers: corsHeaders });

  const record = JSON.parse(raw);
  await sendPush(record.subscription, {
    title: 'IKEA Second-Hand Test',
    body: 'This is a test notification.',
    url: '/'
  }, env);

  return json({ ok: true }, { headers: corsHeaders });
}

async function sendPush(subscription, payload, env) {
  const endpoint = subscription?.endpoint;
  if (!endpoint) throw new Error('Missing subscription endpoint');

  const audience = new URL(endpoint).origin;
  const jwt = await createVapidJwt(audience, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

  const headers = {
    TTL: '60',
    Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
    'Crypto-Key': `p256ecdsa=${env.VAPID_PUBLIC_KEY}`
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers
  });

  if (!res.ok) {
    const textBody = await res.text();
    throw new Error(`Push failed: ${res.status} ${textBody}`);
  }
}

async function processSubscriptions(env) {
  let cursor = undefined;
  do {
    const list = await env.SUBSCRIPTIONS.list({ prefix: 'sub:', cursor, limit: 1000 });
    cursor = list.cursor;

    for (const key of list.keys) {
      const raw = await env.SUBSCRIPTIONS.get(key.name);
      if (!raw) continue;
      const record = JSON.parse(raw);
      const combined = [];
      for (const storeId of record.storeIds || []) {
        const payload = await fetchOffers({ storeIds: storeId }, env);
        combined.push(...extractOffers(payload));
      }
      const offers = combined;

      const matches = offers.filter((offer) => matchesKeywords(offer, record.keywords));
      const seen = new Set(record.lastSeenIds || []);
      const fresh = matches.filter((offer) => {
        const id =
          offer?.offers?.[0]?.id ||
          offer?.offers?.[0]?.offerUuid ||
          offer?.id ||
          offer?.offerId ||
          offer?.articleNumbers?.[0] ||
          offer?.articleNumber;
        if (!id) return false;
        return !seen.has(id);
      });

      if (fresh.length > 0) {
        const first = fresh[0];
        const title = first?.title || first?.name || 'New IKEA listing';
        const body = `Found ${fresh.length} new match(es). Tap to view.`;
        await sendPush(record.subscription, { title, body, url: '/' }, env);
      }

      const updatedIds = offers
        .map(
          (offer) =>
            offer?.offers?.[0]?.id ||
            offer?.offers?.[0]?.offerUuid ||
            offer?.id ||
            offer?.offerId ||
            offer?.articleNumbers?.[0] ||
            offer?.articleNumber
        )
        .filter(Boolean)
        .slice(0, 200);

      record.lastSeenIds = updatedIds;
      await env.SUBSCRIPTIONS.put(key.name, JSON.stringify(record));
    }
  } while (cursor);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return text('', { headers: corsHeaders });
    }

    const url = new URL(request.url);
  if (url.pathname === '/api/items' && request.method === 'GET') {
    return handleItems(request, env);
  }

  if (url.pathname === '/api/stores' && request.method === 'GET') {
    return json({ stores: parseStores(env) }, { headers: corsHeaders });
  }

    if (url.pathname === '/api/subscribe' && request.method === 'POST') {
      return handleSubscribe(request, env);
    }

    if (url.pathname === '/api/unsubscribe' && request.method === 'POST') {
      return handleUnsubscribe(request, env);
    }

    if (url.pathname === '/api/test-notification' && request.method === 'POST') {
      return handleTestNotification(request, env);
    }

    return json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processSubscriptions(env));
  }
};
