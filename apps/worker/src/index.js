import { json, text, corsHeaders } from './http.js';
import { hashEndpoint } from './hash.js';
import { searchItems, extractOffers, mergeUniqueOffersById, resolveOfferId } from './offers.js';
import { matchKeyword, matchesKeywords, normalizeAlertKeywords, normalizeForMatch } from './keyword-match.js';
import { sendPush } from './push.js';
import { enqueueNotification, processSubscriptions } from './subscription-processing.js';

function parseStores(env) {
  try {
    const stores = JSON.parse(env.STORES_JSON || '[]');
    if (Array.isArray(stores)) return stores;
  } catch (err) {
    return [];
  }
  return [];
}

async function handleItems(request, env) {
  const result = await searchItems(request, env);
  return json(result.body, {
    status: result.status,
    headers: corsHeaders
  });
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

export const __testables = {
  extractOffers,
  mergeUniqueOffersById,
  matchesKeywords,
  normalizeForMatch,
  normalizeAlertKeywords,
  matchKeyword,
  resolveOfferId
};

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
      const dryRun = searchParams.get('dryRun') === '1';
      const debug = searchParams.get('debug') === '1';
      const summary = await processSubscriptions(env, { force, dryRun, debug });
      if (debug) return json({ ok: true, force, dryRun, debug, summary }, { headers: corsHeaders });
      return json({ ok: true, force, dryRun }, { headers: corsHeaders });
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
    ctx.waitUntil(processSubscriptions(env, { dryRun: false, debug: false }));
  }
};
