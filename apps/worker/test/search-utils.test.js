import { describe, expect, it } from 'vitest';
import { buildQueryVariants, normalizeQuery, parseStoreIdList } from '../../../shared/search-utils.js';
import { __testables } from '../src/index.js';

describe('search utils', () => {
  it('normalizes whitespace in query', () => {
    expect(normalizeQuery('  billy   shelf  ')).toBe('billy shelf');
  });

  it('parses and deduplicates store IDs', () => {
    expect(parseStoreIdList('294, 203,294')).toEqual(['294', '203']);
  });

  it('creates fallback query variants', () => {
    expect(buildQueryVariants('billy shelf')).toEqual(['billy shelf', 'billy', 'shelf']);
  });
});

describe('offer extraction', () => {
  it('extracts from content array', () => {
    expect(__testables.extractOffers({ content: [{ id: 'x' }] })).toEqual([{ id: 'x' }]);
  });

  it('falls back to empty array', () => {
    expect(__testables.extractOffers({ bad: true })).toEqual([]);
  });
});

describe('notification keyword matching', () => {
  it('normalizes diacritics and punctuation', () => {
    expect(__testables.normalizeForMatch('Trådfri - Żarówka!')).toBe('tradfri zarowka');
  });

  it('matches tradfri keyword against Trådfri text', () => {
    expect(__testables.matchKeyword('Nowa lampa TRÅDFRI', 'tradfri')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(__testables.matchKeyword('TONSTAD szafka', 'tonstad')).toBe(true);
  });

  it('does not overmatch unrelated terms', () => {
    expect(__testables.matchKeyword('BILLY regał', 'tonstad')).toBe(false);
  });
});
