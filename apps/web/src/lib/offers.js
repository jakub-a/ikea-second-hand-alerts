import { normalizeQuery, parseStoreIdList } from '../../../../shared/search-utils.js';

function parseDateToMs(value) {
  if (!value || typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function parseSortOfferNumber(value) {
  if (value === null || value === undefined) return null;
  const numeric = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

export function sortOffersNewestFirst(items) {
  return [...items].sort((a, b) => {
    const aTs = Number.isFinite(a?.sortTimestampMs) ? a.sortTimestampMs : null;
    const bTs = Number.isFinite(b?.sortTimestampMs) ? b.sortTimestampMs : null;
    if (aTs !== null || bTs !== null) {
      if (aTs === null) return 1;
      if (bTs === null) return -1;
      if (aTs !== bTs) return bTs - aTs;
    }

    const aOfferNumber = Number.isFinite(a?.sortOfferNumber) ? a.sortOfferNumber : null;
    const bOfferNumber = Number.isFinite(b?.sortOfferNumber) ? b.sortOfferNumber : null;
    if (aOfferNumber !== null || bOfferNumber !== null) {
      if (aOfferNumber === null) return 1;
      if (bOfferNumber === null) return -1;
      if (aOfferNumber !== bOfferNumber) return bOfferNumber - aOfferNumber;
    }

    return (a?.sourceIndex || 0) - (b?.sourceIndex || 0);
  });
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

function normalizeOffer(offer, sourceIndex = 0, stores = []) {
  const title = offer?.title || offer?.name || offer?.productName || 'Untitled item';
  const description = offer?.description || offer?.shortDescription || offer?.subtitle || '';
  const firstOffer = Array.isArray(offer?.offers) ? offer.offers[0] : null;
  const price =
    firstOffer?.price ||
    offer?.minPrice ||
    offer?.price?.current ||
    offer?.price ||
    offer?.salesPrice ||
    null;
  const originalPrice = offer?.originalPrice || offer?.price?.original || null;
  const discountPercent =
    originalPrice && price
      ? Math.round(((Number(originalPrice) - Number(price)) / Number(originalPrice)) * 100)
      : null;
  const currency = offer?.currency || offer?.price?.currency || 'PLN';
  const image = offer?.heroImage || offer?.image?.url || offer?.image || offer?.media?.[0]?.url || '';
  const id =
    firstOffer?.id ||
    offer?.id ||
    offer?.offerId ||
    offer?.articleNumbers?.[0] ||
    offer?.articleNumber ||
    title;
  const condition =
    firstOffer?.productConditionTitle ||
    offer?.productConditionTitle ||
    firstOffer?.productConditionCode ||
    '';
  const articleNumber = offer?.articleNumbers?.[0] || offer?.articleNumber || '';
  const offerNumber = firstOffer?.offerNumber || offer?.offerNumber || '';
  const sortTimestampMs =
    parseDateToMs(firstOffer?.createdAt) ||
    parseDateToMs(firstOffer?.publishedAt) ||
    parseDateToMs(firstOffer?.updatedAt) ||
    parseDateToMs(offer?.createdAt) ||
    parseDateToMs(offer?.publishedAt) ||
    parseDateToMs(offer?.updatedAt);
  const sortOfferNumber = parseSortOfferNumber(offerNumber);
  const storeId = offer?.storeId || offer?.storeID || offer?.store || '';
  const storeSlug = stores.find((store) => store.id === storeId)?.slug;
  const secondHandUrl =
    offerNumber && storeSlug
      ? `https://www.ikea.com/pl/pl/second-hand/buy-from-ikea/#/${storeSlug}/${offerNumber}`
      : '';
  const url =
    offer?.url ||
    offer?.productUrl ||
    secondHandUrl ||
    (articleNumber
      ? `https://www.ikea.com/pl/pl/search/?q=${encodeURIComponent(articleNumber)}`
      : `https://www.ikea.com/pl/pl/search/?q=${encodeURIComponent(title)}`);
  return {
    id,
    title,
    description,
    price,
    originalPrice,
    discountPercent,
    currency,
    image,
    url,
    condition,
    storeId,
    sortTimestampMs,
    sortOfferNumber,
    sourceIndex
  };
}

export async function fetchOffers({ apiBase, stores, storeIds, query }) {
  const normalizedStoreIds = parseStoreIdList(storeIds).join(',');
  const normalizedQuery = normalizeQuery(query);
  const params = new URLSearchParams({
    languageCode: 'pl',
    size: '32',
    storeIds: normalizedStoreIds,
    page: '0',
    allPages: '1'
  });
  if (normalizedQuery) params.set('query', normalizedQuery);
  const res = await fetch(`${apiBase}/api/items?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load offers');
  const data = await res.json();
  const normalized = extractOffers(data).map((offer, index) => normalizeOffer(offer, index, stores));
  return sortOffersNewestFirst(normalized);
}
