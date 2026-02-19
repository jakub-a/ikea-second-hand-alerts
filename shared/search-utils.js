export function parseStoreIdList(input) {
  if (!input) return [];
  const raw = Array.isArray(input) ? input : String(input).split(',');
  return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))];
}

export function normalizeQuery(input) {
  if (!input) return '';
  return String(input).replace(/\s+/g, ' ').trim();
}

export function buildQueryVariants(input) {
  const normalized = normalizeQuery(input);
  if (!normalized) return [];
  const tokens = [...new Set(normalized.split(' ').map((token) => token.trim()).filter((token) => token.length >= 2))];
  const variants = [normalized];
  if (tokens.length > 1 && tokens.join(' ') !== normalized) variants.push(tokens.join(' '));
  for (const token of tokens) {
    if (!variants.includes(token)) variants.push(token);
  }
  return variants;
}
