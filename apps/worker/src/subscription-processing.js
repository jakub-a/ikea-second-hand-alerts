import { extractOffers, fetchOffers, resolveOfferId } from './offers.js';
import { matchesKeywords, normalizeAlertKeywords } from './keyword-match.js';
import { sendPush } from './push.js';

export async function enqueueNotification(env, key, payload) {
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

function pushMissSample(samples, reason, offer) {
  if (samples.length >= 5) return;
  samples.push({
    reason,
    offerId: resolveOfferId(offer),
    title: offer?.title || offer?.name || 'unknown'
  });
}

export async function processSubscriptions(env, options = {}) {
  const debug = options.debug === true;
  const dryRun = options.dryRun === true;
  const summary = {
    startedAt: new Date().toISOString(),
    dryRun,
    force: options.force === true,
    subscriptionsProcessed: 0,
    alertsEvaluated: 0,
    notificationsQueued: 0,
    notificationsSent: 0,
    subscriptions: []
  };

  let cursor = undefined;
  do {
    const list = await env.SUBSCRIPTIONS.list({ prefix: 'sub:', cursor, limit: 1000 });
    cursor = list.cursor;

    for (const key of list.keys) {
      const raw = await env.SUBSCRIPTIONS.get(key.name);
      if (!raw) continue;
      const record = JSON.parse(raw);
      const subscriptionSummary = {
        subscriptionId: key.name.replace('sub:', '').slice(0, 12),
        activeAlerts: 0,
        fetchErrors: [],
        alerts: []
      };
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
      subscriptionSummary.activeAlerts = activeAlerts.length;
      const storeIds = [...new Set(activeAlerts.flatMap((alert) => alert.storeIds || []))];
      const offersByStore = new Map();

      for (const storeId of storeIds) {
        try {
          const payload = await fetchOffers({ storeIds: storeId }, env);
          offersByStore.set(storeId, extractOffers(payload));
        } catch (err) {
          offersByStore.set(storeId, []);
          if (debug) {
            subscriptionSummary.fetchErrors.push({
              storeId,
              error: err?.message || 'unknown_error'
            });
          }
        }
      }

      const seen = options.force ? new Set() : new Set(record.lastSeenIds || []);
      const endpointKey = key.name.replace('sub:', '');
      for (const alert of activeAlerts) {
        summary.alertsEvaluated += 1;
        const normalizedKeywords = normalizeAlertKeywords(alert.keywords || []);
        const perStoreOffers = (alert.storeIds || []).flatMap((id) => offersByStore.get(id) || []);
        const alertDebug = {
          alertId: alert.id || 'unknown',
          name: alert.name || 'Alert',
          keywords: normalizedKeywords,
          offersScanned: perStoreOffers.length,
          offersMatched: 0,
          offersFresh: 0,
          offersSuppressedBySeen: 0,
          offersMissingId: 0,
          sampleMissReasons: []
        };
        const matches = [];
        for (const offer of perStoreOffers) {
          if (normalizedKeywords.length === 0 || !matchesKeywords(offer, normalizedKeywords)) {
            pushMissSample(alertDebug.sampleMissReasons, 'keyword_miss', offer);
            continue;
          }
          matches.push(offer);
        }
        alertDebug.offersMatched = matches.length;

        const fresh = [];
        for (const offer of matches) {
          const id = resolveOfferId(offer);
          if (!id) {
            alertDebug.offersMissingId += 1;
            pushMissSample(alertDebug.sampleMissReasons, 'missing_offer_id', offer);
            continue;
          }
          if (seen.has(id)) {
            alertDebug.offersSuppressedBySeen += 1;
            pushMissSample(alertDebug.sampleMissReasons, 'seen_offer', offer);
            continue;
          }
          fresh.push(offer);
        }
        alertDebug.offersFresh = fresh.length;

        if (debug) subscriptionSummary.alerts.push(alertDebug);
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
        if (!dryRun) {
          await enqueueNotification(env, endpointKey, payload);
          summary.notificationsQueued += 1;
          await sendPush(record.subscription, null, env);
          summary.notificationsSent += 1;
        }
      }

      const updatedIds = [];
      for (const offers of offersByStore.values()) {
        for (const offer of offers) {
          const id = resolveOfferId(offer);
          if (id) updatedIds.push(id);
        }
      }

      if (!dryRun) {
        record.lastSeenIds = updatedIds.slice(0, 200);
        await env.SUBSCRIPTIONS.put(key.name, JSON.stringify(record));
      }
      summary.subscriptionsProcessed += 1;
      if (debug) summary.subscriptions.push(subscriptionSummary);
    }
  } while (cursor);

  summary.finishedAt = new Date().toISOString();
  return summary;
}
