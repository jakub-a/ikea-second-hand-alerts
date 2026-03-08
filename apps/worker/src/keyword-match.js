export function matchesKeywords(offer, keywords) {
  const normalizedKeywords = normalizeAlertKeywords(keywords);
  if (normalizedKeywords.length === 0) return false;
  const title = offer?.title || offer?.name || '';
  const description = offer?.description || offer?.shortDescription || '';
  const textValue = `${title} ${description}`;
  return normalizedKeywords.some((keyword) => matchKeyword(textValue, keyword));
}

export function normalizeForMatch(input) {
  if (!input) return '';
  return String(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAlertKeywords(keywords) {
  if (!Array.isArray(keywords)) return [];
  const normalized = keywords
    .map((keyword) => normalizeForMatch(keyword))
    .filter((keyword) => keyword.length >= 2);
  return [...new Set(normalized)];
}

export function matchKeyword(offerText, keyword) {
  const normalizedText = normalizeForMatch(offerText);
  const normalizedKeyword = normalizeForMatch(keyword);
  if (!normalizedText || normalizedKeyword.length < 2) return false;

  if (normalizedText.includes(normalizedKeyword)) return true;
  const keywordTokens = normalizedKeyword.split(' ').filter((token) => token.length >= 2);
  if (keywordTokens.length <= 1) return false;
  return keywordTokens.every((token) => normalizedText.includes(token));
}
