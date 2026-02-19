import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index.js';

const env = {
  IKEA_API_BASE: 'https://example.test',
  SUBSCRIPTIONS: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn()
  }
};

function createPayload(items) {
  return {
    content: items,
    totalPages: 1
  };
}

describe('/api/items integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns debug metadata when debug flag is enabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => createPayload([{ id: 'offer-1' }])
      }))
    );

    const request = new Request(
      'https://worker.test/api/items?storeIds=294&query=billy%20%20shelf&allPages=1&debug=1'
    );
    const response = await worker.fetch(request, env);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.debug).toBeDefined();
    expect(data.debug.storeIdList).toEqual(['294']);
    expect(data.debug.query).toBe('billy shelf');
    expect(data.debug.rawCount).toBe(1);
    expect(data.debug.normalizedCount).toBe(1);
  });

  it('uses fallback query variants for empty single-store results', async () => {
    const fetchMock = vi.fn(async (url) => {
      const target = new URL(url);
      const query = target.searchParams.get('query');
      if (query === 'billy shelf') {
        return {
          ok: true,
          json: async () => createPayload([])
        };
      }
      return {
        ok: true,
        json: async () => createPayload([{ id: `offer-${query}` }])
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://worker.test/api/items?storeIds=294&query=billy+shelf');
    const response = await worker.fetch(request, env);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data.content)).toBe(true);
    expect(data.content.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns 400 when storeIds is missing', async () => {
    const request = new Request('https://worker.test/api/items?query=billy');
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(400);
  });
});
