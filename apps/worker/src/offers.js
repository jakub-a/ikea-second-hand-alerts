import { buildQueryVariants, normalizeQuery, parseStoreIdList } from '../../../shared/search-utils.js';
import { hashText } from './hash.js';

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

export function mergeUniqueOffersById(...offerGroups) {
  const merged = [];
  const seen = new Set();
  for (const offers of offerGroups) {
    for (const offer of offers) {
      const id =
        offer?.offers?.[0]?.id ||
        offer?.offers?.[0]?.offerUuid ||
        offer?.id ||
        offer?.offerId ||
        offer?.articleNumbers?.[0] ||
        offer?.articleNumber;
      const key = id ? String(id) : JSON.stringify(offer);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(offer);
    }
  }
  return merged;
}

export async function fetchOffers({ storeIds, languageCode, size, query }, env, { allPages = false } = {}) {
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

export function extractOffers(payload) {
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

export function resolveOfferId(offer) {
  return (
    offer?.offers?.[0]?.id ||
    offer?.offers?.[0]?.offerUuid ||
    offer?.id ||
    offer?.offerId ||
    offer?.articleNumbers?.[0] ||
    offer?.articleNumber ||
    null
  );
}

export async function searchItems(request, env) {
  const { searchParams } = new URL(request.url);
  const rawStoreIds = searchParams.get('storeIds');
  const storeIdList = parseStoreIdList(rawStoreIds);
  if (storeIdList.length === 0) {
    return {
      status: 400,
      body: { error: 'Missing storeIds' }
    };
  }

  const languageCode = searchParams.get('languageCode') || 'pl';
  const size = searchParams.get('size') || '32';
  const allPages = searchParams.get('allPages') === '1';
  const debugEnabled = searchParams.get('debug') === '1' || request.headers.get('x-debug-search') === '1';
  const normalizedQuery = normalizeQuery(searchParams.get('query') || '');
  const queryVariants = buildQueryVariants(normalizedQuery);
  const primaryQuery = queryVariants[0] || undefined;
  const storeIds = storeIdList.join(',');

  const payload = await fetchOffers({ storeIds, languageCode, size, query: primaryQuery }, env, { allPages });
  const rawOffers = extractOffers(payload);
  let finalOffers = rawOffers;

  if (storeIdList.length === 1 && rawOffers.length === 0 && queryVariants.length > 1) {
    const fallbackPayloads = await Promise.all(
      queryVariants.slice(1).map((variant) =>
        fetchOffers({ storeIds, languageCode, size, query: variant }, env, { allPages })
      )
    );
    const fallbackOffers = fallbackPayloads.flatMap((item) => extractOffers(item));
    finalOffers = mergeUniqueOffersById(rawOffers, fallbackOffers);
  }

  const outputPayload = {
    ...payload,
    content: finalOffers
  };

  if (!debugEnabled) {
    return {
      status: 200,
      body: outputPayload
    };
  }

  const requestFingerprint = await hashText(
    JSON.stringify({
      storeIdList,
      normalizedQuery,
      allPages,
      size,
      languageCode
    })
  );

  const debug = {
    requestFingerprint,
    storeIds: rawStoreIds,
    storeIdList,
    query: normalizedQuery,
    queryVariants,
    allPages,
    rawCount: rawOffers.length,
    normalizedCount: finalOffers.length
  };

  console.log('[items-debug]', JSON.stringify(debug));
  return {
    status: 200,
    body: { ...outputPayload, debug }
  };
}
