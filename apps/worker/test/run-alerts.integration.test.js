import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index.js';

function createEnv(recordOverride = {}) {
  const subscriptionRecord = {
    endpoint: 'https://push.example.com/sub-1',
    subscription: {
      endpoint: 'https://push.example.com/sub-1',
      keys: {
        auth: 'test-auth',
        p256dh: 'test-p256'
      }
    },
    alerts: [
      {
        id: 'a-tradfri',
        name: 'Tradfri Alert',
        keywords: ['tradfri'],
        storeIds: ['294'],
        active: true
      },
      {
        id: 'a-tonstad',
        name: 'Tonstad Alert',
        keywords: ['tonstad'],
        storeIds: ['294'],
        active: true
      }
    ],
    lastSeenIds: [],
    ...recordOverride
  };

  return {
    IKEA_API_BASE: 'https://ikea.example.test',
    SUBSCRIPTIONS: {
      list: vi.fn(async () => ({
        keys: [{ name: 'sub:abc123' }],
        cursor: undefined
      })),
      get: vi.fn(async (key) => {
        if (key === 'sub:abc123') return JSON.stringify(subscriptionRecord);
        return null;
      }),
      put: vi.fn(),
      delete: vi.fn()
    }
  };
}

describe('/api/run-alerts integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns debug dry-run summary and matches diacritic keywords', async () => {
    const env = createEnv();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        const target = new URL(url);
        if (target.hostname === 'ikea.example.test') {
          return {
            ok: true,
            json: async () => ({
              content: [
                { id: 'o1', title: 'TRÅDFRI żarówka', description: 'smart', offers: [{ id: 'tradfri-1' }] },
                { id: 'o2', title: 'TONSTAD szafa', description: 'wood', offers: [{ id: 'tonstad-1' }] }
              ]
            })
          };
        }
        throw new Error('Unexpected fetch target');
      })
    );

    const request = new Request('https://worker.test/api/run-alerts?dryRun=1&debug=1', { method: 'POST' });
    const response = await worker.fetch(request, env);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.debug).toBe(true);
    expect(data.summary.dryRun).toBe(true);
    expect(data.summary.subscriptionsProcessed).toBe(1);
    expect(data.summary.alertsEvaluated).toBe(2);
    expect(data.summary.notificationsQueued).toBe(0);
    expect(data.summary.notificationsSent).toBe(0);

    const tradfri = data.summary.subscriptions[0].alerts.find((alert) => alert.alertId === 'a-tradfri');
    expect(tradfri.offersMatched).toBeGreaterThan(0);
    expect(tradfri.offersFresh).toBeGreaterThan(0);
  });

  it('reports seen suppression in debug mode', async () => {
    const env = createEnv({ lastSeenIds: ['tradfri-1'] });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          content: [{ id: 'o1', title: 'TRÅDFRI żarówka', offers: [{ id: 'tradfri-1' }] }]
        })
      }))
    );

    const request = new Request('https://worker.test/api/run-alerts?debug=1&dryRun=1', { method: 'POST' });
    const response = await worker.fetch(request, env);
    const data = await response.json();
    const tradfri = data.summary.subscriptions[0].alerts.find((alert) => alert.alertId === 'a-tradfri');

    expect(tradfri.offersMatched).toBe(1);
    expect(tradfri.offersFresh).toBe(0);
    expect(tradfri.offersSuppressedBySeen).toBe(1);
  });

  it('handles malformed offer payloads without crashing', async () => {
    const env = createEnv();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          content: [{ title: null, description: null, offers: [{}] }]
        })
      }))
    );

    const request = new Request('https://worker.test/api/run-alerts?debug=1&dryRun=1', { method: 'POST' });
    const response = await worker.fetch(request, env);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary.subscriptions[0].alerts.length).toBeGreaterThan(0);
    expect(Array.isArray(data.summary.subscriptions[0].alerts[0].sampleMissReasons)).toBe(true);
  });
});
