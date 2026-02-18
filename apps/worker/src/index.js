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

function uint16be(value) {
  return new Uint8Array([(value >> 8) & 0xff, value & 0xff]);
}

function concatBytes(...arrays) {
  const total = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  arrays.forEach((arr) => {
    output.set(arr, offset);
    offset += arr.length;
  });
  return output;
}

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info
    },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

async function encryptPayload(subscription, payload, vapidPublicKey) {
  const clientPublicKey = base64UrlDecode(subscription.keys.p256dh);
  const authSecret = base64UrlDecode(subscription.keys.auth);

  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey));

  const clientPublicKeyCrypto = await crypto.subtle.importKey(
    'raw',
    clientPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: clientPublicKeyCrypto },
      serverKeyPair.privateKey,
      256
    )
  );

  const info = concatBytes(
    encoder.encode('WebPush: info\0'),
    clientPublicKey,
    serverPublicKeyRaw
  );

  const prk = await hkdf(authSecret, sharedSecret, info, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const context = concatBytes(
    encoder.encode('P-256'),
    new Uint8Array([0x00]),
    uint16be(clientPublicKey.length),
    clientPublicKey,
    uint16be(serverPublicKeyRaw.length),
    serverPublicKeyRaw
  );

  const cekInfo = concatBytes(encoder.encode('Content-Encoding: aes128gcm\0'), context);
  const nonceInfo = concatBytes(encoder.encode('Content-Encoding: nonce\0'), context);

  const contentEncryptionKey = await hkdf(salt, prk, cekInfo, 16);
  const nonce = await hkdf(salt, prk, nonceInfo, 12);

  const cek = await crypto.subtle.importKey('raw', contentEncryptionKey, { name: 'AES-GCM' }, false, ['encrypt']);

  const payloadBytes = encoder.encode(payload);
  const pad = new Uint8Array([0x00, 0x00]);
  const plaintext = concatBytes(pad, payloadBytes);

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cek, plaintext)
  );

  return {
    ciphertext,
    salt,
    serverPublicKey: serverPublicKeyRaw,
    vapidPublicKey
  };
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
  const { subscription, keywords, storeIds, alerts } = body || {};

  if (!subscription?.endpoint || !storeIds || storeIds.length === 0) {
    return json({ error: 'Missing subscription or storeId' }, { status: 400, headers: corsHeaders });
  }

  const key = await hashEndpoint(subscription.endpoint);
  const record = {
    endpoint: subscription.endpoint,
    subscription,
    keywords: Array.isArray(keywords) ? keywords : [],
    storeIds: Array.isArray(storeIds) ? storeIds : [storeIds],
    alerts: Array.isArray(alerts) ? alerts : [],
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

  const payload = {
    title: 'IKEA Second-Hand Test',
    body: 'This is a test notification.',
    url: '/?test=1',
    alertId: null,
    newCount: 0
  };

  await enqueueNotification(env, key, payload);
  const record = JSON.parse(raw);
  const result = await sendPush(record.subscription, null, env);

  return json({ ok: true, status: result.status }, { headers: corsHeaders });
}

async function handleNextNotification(request, env) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  if (!endpoint) return json({ error: 'Missing endpoint' }, { status: 400, headers: corsHeaders });

  const key = await hashEndpoint(endpoint);
  const raw = await env.SUBSCRIPTIONS.get(`notif:${key}`);
  if (!raw) return json({ ok: false }, { status: 404, headers: corsHeaders });

  const parsed = JSON.parse(raw);
  const queue = Array.isArray(parsed?.queue) ? parsed.queue : [parsed];
  if (queue.length === 0) {
    await env.SUBSCRIPTIONS.delete(`notif:${key}`);
    return json({ ok: false }, { status: 404, headers: corsHeaders });
  }
  const payload = queue.shift();
  if (queue.length === 0) {
    await env.SUBSCRIPTIONS.delete(`notif:${key}`);
  } else {
    await env.SUBSCRIPTIONS.put(`notif:${key}`, JSON.stringify({ queue }), { expirationTtl: 300 });
  }
  return json({ ok: true, payload }, { headers: corsHeaders });
}

async function handleAlerts(request, env) {
  const body = await request.json();
  const { endpoint, alerts } = body || {};
  if (!endpoint) return json({ error: 'Missing endpoint' }, { status: 400, headers: corsHeaders });

  const key = await hashEndpoint(endpoint);
  const raw = await env.SUBSCRIPTIONS.get(`sub:${key}`);
  if (!raw) return json({ error: 'Subscription not found' }, { status: 404, headers: corsHeaders });

  const record = JSON.parse(raw);
  record.alerts = Array.isArray(alerts) ? alerts : [];
  await env.SUBSCRIPTIONS.put(`sub:${key}`, JSON.stringify(record));
  return json({ ok: true }, { headers: corsHeaders });
}

async function handleTestAlert(request, env) {
  const body = await request.json();
  const { endpoint, alert } = body || {};
  if (!endpoint || !alert) return json({ error: 'Missing endpoint or alert' }, { status: 400, headers: corsHeaders });

  const key = await hashEndpoint(endpoint);
  const alertId = alert.id || null;
  const alertKeywords = Array.isArray(alert.keywords) ? alert.keywords : [];
  const alertStores = Array.isArray(alert.storeIds) ? alert.storeIds : [];
  const notificationId = crypto.randomUUID();
  const payload = {
    title: alert.name || 'IKEA Alert Test',
    body: `Test alert: ${alertKeywords.join(', ')}`,
    url: (() => {
      const params = new URLSearchParams();
      params.set('tab', 'alerts');
      if (alertId) params.set('alertId', alertId);
      if (alertStores.length) params.set('stores', alertStores.join(','));
      if (alertKeywords.length) params.set('keywords', alertKeywords.join(','));
      params.set('notificationId', notificationId);
      const qs = params.toString();
      return qs ? `/?${qs}` : '/';
    })(),
    alertId,
    newCount: 0,
    notificationId
  };

  await enqueueNotification(env, key, payload);
  const result = await sendPush({ endpoint }, null, env);
  return json({ ok: true, status: result.status }, { headers: corsHeaders });
}

async function sendPush(subscription, payload, env) {
  const endpoint = subscription?.endpoint;
  if (!endpoint) throw new Error('Missing subscription endpoint');

  const audience = new URL(endpoint).origin;
  const jwt = await createVapidJwt(audience, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  let headers = {
    TTL: '60',
    Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
    'Crypto-Key': `p256ecdsa=${env.VAPID_PUBLIC_KEY}`
  };
  let body;

  if (payload) {
    const payloadJson = JSON.stringify(payload);
    const encrypted = await encryptPayload(subscription, payloadJson, env.VAPID_PUBLIC_KEY);
    headers = {
      ...headers,
      'Crypto-Key': `dh=${base64UrlEncode(encrypted.serverPublicKey)}; p256ecdsa=${env.VAPID_PUBLIC_KEY}`,
      Encryption: `salt=${base64UrlEncode(encrypted.salt)}; rs=4096`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream'
    };
    body = encrypted.ciphertext;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body
  });

  if (!res.ok) {
    const textBody = await res.text();
    throw new Error(`Push failed: ${res.status} ${textBody}`);
  }

  return { status: res.status };
}

async function enqueueNotification(env, key, payload) {
  const existing = await env.SUBSCRIPTIONS.get(`notif:${key}`);
  if (!existing) {
    await env.SUBSCRIPTIONS.put(`notif:${key}`, JSON.stringify({ queue: [payload] }), { expirationTtl: 300 });
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(existing);
  } catch (err) {
    parsed = null;
  }
  const queue = Array.isArray(parsed?.queue)
    ? parsed.queue
    : parsed
      ? [parsed]
      : [];
  queue.push(payload);
  await env.SUBSCRIPTIONS.put(`notif:${key}`, JSON.stringify({ queue }), { expirationTtl: 300 });
}

async function processSubscriptions(env, options = {}) {
  let cursor = undefined;
  do {
    const list = await env.SUBSCRIPTIONS.list({ prefix: 'sub:', cursor, limit: 1000 });
    cursor = list.cursor;

    for (const key of list.keys) {
      const raw = await env.SUBSCRIPTIONS.get(key.name);
      if (!raw) continue;
      const record = JSON.parse(raw);
      const alerts = Array.isArray(record.alerts) && record.alerts.length > 0
        ? record.alerts
        : [
            {
              id: 'legacy',
              name: 'Default alert',
              keywords: record.keywords || [],
              storeIds: record.storeIds || [],
              active: true
            }
          ];

      const activeAlerts = alerts.filter((alert) => alert.active);
      const storeIds = [...new Set(activeAlerts.flatMap((alert) => alert.storeIds || []))];
      const offersByStore = new Map();

      for (const storeId of storeIds) {
        const payload = await fetchOffers({ storeIds: storeId }, env);
        offersByStore.set(storeId, extractOffers(payload));
      }

      const seen = options.force ? new Set() : new Set(record.lastSeenIds || []);
      const endpointKey = key.name.replace('sub:', '');
      for (const alert of activeAlerts) {
        const perStoreOffers = (alert.storeIds || []).flatMap((id) => offersByStore.get(id) || []);
        const matches = perStoreOffers.filter((offer) => matchesKeywords(offer, alert.keywords || []));
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
        if (fresh.length === 0) continue;

        const first = fresh[0];
        const title = first?.title || first?.name || 'New IKEA listing';
        const alertName = alert.name || 'Alert';
        const body = `${alertName}: ${fresh.length} new match(es).`;
        const notificationId = crypto.randomUUID();
        const params = new URLSearchParams();
        params.set('tab', 'alerts');
        if (alert.id) params.set('alertId', alert.id);
        if (alert.storeIds?.length) params.set('stores', alert.storeIds.join(','));
        if (alert.keywords?.length) params.set('keywords', alert.keywords.join(','));
        params.set('newCount', String(fresh.length));
        params.set('notificationId', notificationId);
        const url = params.toString() ? `/?${params}` : '/';
        const payload = {
          title,
          body,
          url,
          alertId: alert.id || null,
          newCount: fresh.length,
          notificationId
        };
        await enqueueNotification(env, endpointKey, payload);
        await sendPush(record.subscription, null, env);
      }

      const updatedIds = [];
      for (const offers of offersByStore.values()) {
        for (const offer of offers) {
          const id =
            offer?.offers?.[0]?.id ||
            offer?.offers?.[0]?.offerUuid ||
            offer?.id ||
            offer?.offerId ||
            offer?.articleNumbers?.[0] ||
            offer?.articleNumber;
          if (id) updatedIds.push(id);
        }
      }

      record.lastSeenIds = updatedIds.slice(0, 200);
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

    if (url.pathname === '/api/alerts' && request.method === 'POST') {
      return handleAlerts(request, env);
    }

    if (url.pathname === '/api/meta' && request.method === 'GET') {
      return json({ versionId: env.WORKER_VERSION_ID || 'unknown' }, { headers: corsHeaders });
    }

    if (url.pathname === '/api/next-notification' && request.method === 'GET') {
      return handleNextNotification(request, env);
    }

    if (url.pathname === '/api/test-alert' && request.method === 'POST') {
      return handleTestAlert(request, env);
    }

  if (url.pathname === '/api/run-alerts' && request.method === 'POST') {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === '1';
    await processSubscriptions(env, { force });
    return json({ ok: true, force }, { headers: corsHeaders });
  }

  if (url.pathname === '/api/debug-subscription' && request.method === 'GET') {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    if (!endpoint) return json({ error: 'Missing endpoint' }, { status: 400, headers: corsHeaders });
    const key = await hashEndpoint(endpoint);
    const raw = await env.SUBSCRIPTIONS.get(`sub:${key}`);
    if (!raw) return json({ error: 'Subscription not found' }, { status: 404, headers: corsHeaders });
    return json({ ok: true, record: JSON.parse(raw) }, { headers: corsHeaders });
  }

    return json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processSubscriptions(env));
  }
};
