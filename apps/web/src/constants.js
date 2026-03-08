export const DEFAULT_STORE_ID = '294'; // Wroclaw (from captured request)
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'dev';
export const API_BASE = import.meta.env.VITE_API_BASE || '';

export const EMPTY_STATE_ARTWORK_SRC = '/empty-state/plush.png';
export const EMPTY_STATE_SEARCH_ICON_SRC = '/empty-state/search-icon.svg';
export const EMPTY_STATE_SQUIGGLE_TOP_LEFT_SRC = '/empty-state/squiggle-top-left.svg';
export const EMPTY_STATE_SQUIGGLE_LEFT_SRC = '/empty-state/squiggle-left.svg';
export const EMPTY_STATE_SQUIGGLE_RIGHT_SRC = '/empty-state/squiggle-right.svg';
export const EMPTY_STATE_SQUIGGLE_SMALL_SRC = '/empty-state/squiggle-small.svg';

export const KNOWN_STORES = [
  { id: '188', label: 'Warszawa Janki', slug: 'warszawa+janki' },
  { id: '203', label: 'Gdańsk', slug: 'gdańsk' },
  { id: '204', label: 'Kraków', slug: 'kraków' },
  { id: '205', label: 'Poznań', slug: 'poznań' },
  { id: '294', label: 'Wrocław', slug: 'wrocław' },
  { id: '306', label: 'Katowice', slug: 'katowice' },
  { id: '307', label: 'Warszawa Targówek', slug: 'warszawa+targówek' },
  { id: '311', label: 'Lublin', slug: 'lublin' },
  { id: '329', label: 'Łódź', slug: 'łódź' },
  { id: '429', label: 'Bydgoszcz', slug: 'bydgoszcz' }
];
