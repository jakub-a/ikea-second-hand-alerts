import React, { useMemo, useState } from 'react';

const DEFAULT_STORE_ID = '294'; // Wroclaw (from captured request)

const KNOWN_STORES = [
  { id: '188', label: 'Warszawa Janki' },
  { id: '203', label: 'Gdańsk' },
  { id: '204', label: 'Kraków' },
  { id: '205', label: 'Poznań' },
  { id: '294', label: 'Wrocław' },
  { id: '306', label: 'Katowice' },
  { id: '307', label: 'Warszawa Targówek' },
  { id: '311', label: 'Lublin' },
  { id: '329', label: 'Łódź' },
  { id: '429', label: 'Bydgoszcz' }
];

const API_BASE = import.meta.env.VITE_API_BASE || '';

function extractOffers(payload) {
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

function normalizeOffer(offer) {
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
  const url =
    offer?.url ||
    offer?.productUrl ||
    (articleNumber
      ? `https://www.ikea.com/pl/pl/search/?q=${encodeURIComponent(articleNumber)}`
      : `https://www.ikea.com/pl/pl/search/?q=${encodeURIComponent(title)}`);
  const storeId = offer?.storeId || offer?.storeID || offer?.store || '';
  return { id, title, description, price, currency, image, url, condition, storeId };
}

async function fetchOffers(storeIds, query) {
  const params = new URLSearchParams({
    languageCode: 'pl',
    size: '32',
    storeIds,
    page: '0',
    allPages: '1'
  });
  if (query) params.set('query', query);
  const res = await fetch(`${API_BASE}/api/items?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load offers');
  const data = await res.json();
  return extractOffers(data).map(normalizeOffer);
}

async function requestPushPermission() {
  if (!('Notification' in window)) throw new Error('Notifications not supported');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permission denied');
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function subscribeToPush({ keywords, storeIds }) {
  await requestPushPermission();
  const registration = await navigator.serviceWorker.ready;
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidKey) throw new Error('Missing VITE_VAPID_PUBLIC_KEY');
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey)
  });

  const res = await fetch(`${API_BASE}/api/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription, keywords, storeIds })
  });

  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.error ? ` (${data.error})` : '';
    } catch (err) {
      detail = '';
    }
    throw new Error(`Failed to save subscription${detail}`);
  }
  return subscription;
}

async function unsubscribeFromPush() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await fetch(`${API_BASE}/api/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint })
  });

  await subscription.unsubscribe();
}

async function sendTestNotification() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) throw new Error('Enable push alerts first.');

  const res = await fetch(`${API_BASE}/api/test-notification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint })
  });

  if (!res.ok) throw new Error('Failed to send test notification.');
}

export default function App() {
  const [selectedStoreIds, setSelectedStoreIds] = useState([DEFAULT_STORE_ID]);
  const [stores, setStores] = useState(KNOWN_STORES);
  const [keywordsInput, setKeywordsInput] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [offers, setOffers] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const activeStoreIds = useMemo(() => {
    return selectedStoreIds.length > 0 ? selectedStoreIds : [];
  }, [selectedStoreIds]);

  const filteredOffers = useMemo(() => {
    if (keywords.length === 0) return offers;
    return offers.filter((offer) => {
      const text = `${offer.title} ${offer.description}`.toLowerCase();
      return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
    });
  }, [offers, keywords]);

  const groupedOffers = useMemo(() => {
    const grouped = new Map();
    for (const offer of filteredOffers) {
      const key = offer.storeId || 'unknown';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(offer);
    }
    return grouped;
  }, [filteredOffers]);

  const storeLabelFor = (id) => {
    const match = stores.find((store) => store.id === id);
    return match ? match.label : 'Unknown store';
  };

  const refresh = async () => {
    try {
      setLoading(true);
      setStatus('');
      if (activeStoreIds.length === 0) {
        setStatus('Select at least one store.');
        return;
      }
      const query = keywords.length > 0 ? keywords.join(' ') : '';
      const data = await fetchOffers(activeStoreIds.join(','), query);
      setOffers(data);
      setStatus(`Loaded ${data.length} items.`);
    } catch (err) {
      setStatus(err.message || 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  const applyKeywords = () => {
    const list = keywordsInput
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    setKeywords(list);
  };

  const handleSubscribe = async () => {
    try {
      setStatus('');
      if (activeStoreIds.length === 0) {
        setStatus('Select at least one store.');
        return;
      }
      await subscribeToPush({ keywords, storeIds: activeStoreIds });
      setSubscribed(true);
      setStatus('Push alerts enabled.');
    } catch (err) {
      setStatus(err.message || 'Failed to enable alerts');
    }
  };

  const handleUnsubscribe = async () => {
    try {
      setStatus('');
      await unsubscribeFromPush();
      setSubscribed(false);
      setStatus('Push alerts disabled.');
    } catch (err) {
      setStatus(err.message || 'Failed to disable alerts');
    }
  };

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">IKEA Second-Hand Watch</p>
          <h1>Catch the good stuff before it disappears.</h1>
          <p className="subtitle">
            Track "Buy from IKEA" second-hand listings, filter by keyword, and get push alerts on your phone.
          </p>
        </div>
      </header>

      <section className="card">
        <h2>Stores</h2>
        <div className="store-tags">
          {stores.map((store) => {
            const active = selectedStoreIds.includes(store.id);
            return (
              <button
                key={store.id}
                type="button"
                className={`tag ${active ? 'tag-active' : ''}`}
                onClick={() => {
                  setSelectedStoreIds((prev) => {
                    if (prev.includes(store.id)) return prev.filter((id) => id !== store.id);
                    return [...prev, store.id];
                  });
                }}
              >
                <span className="tag-name">{store.label}</span>
                <span className="tag-id">ID: {store.id}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Keywords</h2>
        <p className="helper">Separate keywords with commas. We match against title + description.</p>
        <div className="field-row">
          <input
            value={keywordsInput}
            onChange={(e) => setKeywordsInput(e.target.value)}
            placeholder="sofa, lamp, desk"
          />
          <button onClick={applyKeywords}>Apply</button>
        </div>
        {keywords.length > 0 && (
          <div className="chips">
            {keywords.map((keyword) => (
              <span key={keyword}>{keyword}</span>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Alerts</h2>
        <p className="helper">To enable push alerts on iPhone, add this app to your Home Screen first.</p>
        <div className="field-row">
          {!subscribed ? (
            <button onClick={handleSubscribe}>Enable Push Alerts</button>
          ) : (
            <button className="secondary" onClick={handleUnsubscribe}>Disable Push Alerts</button>
          )}
          <button className="ghost" onClick={refresh} disabled={loading}>
            {loading ? 'Refreshing…' : 'Manual Refresh'}
          </button>
        </div>
        <div className="field-row">
          <button className="subtle" onClick={async () => {
            try {
              setStatus('');
              await sendTestNotification();
              setStatus('Test notification sent.');
            } catch (err) {
              setStatus(err.message || 'Failed to send test notification.');
            }
          }}>
            Send Test Notification
          </button>
        </div>
        {status && <p className="status">{status}</p>}
      </section>

      <section className="card results">
        <div className="results-header">
          <h2>Listings</h2>
          <span>
            {filteredOffers.length} matched / {offers.length} total
          </span>
        </div>
        {keywords.length > 0 && filteredOffers.length === 0 && offers.length > 0 && (
          <p className="helper">No listings match your current keywords. Try a different keyword or clear them to see all items.</p>
        )}
        {[...groupedOffers.entries()].map(([storeId, storeOffers]) => (
          <div key={storeId} className="store-group">
            <div className="store-group-header">
              <h3>{storeLabelFor(storeId)}</h3>
              <span className="store-group-id">ID: {storeId}</span>
            </div>
            <div className="grid">
              {storeOffers.map((offer) => (
                <a
                  key={offer.id}
                  className="offer-link"
                  href={offer.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${offer.title} on IKEA`}
                >
                  <article className="offer">
                    <div className="image">
                      {offer.image ? <img src={offer.image} alt={offer.title} /> : <div className="placeholder" />}
                    </div>
                    <div className="offer-body">
                      <div className="offer-header">
                        <h3>{offer.title}</h3>
                        {offer.condition && <span className="badge">{offer.condition}</span>}
                      </div>
                      {offer.description && <p>{offer.description}</p>}
                      <div className="meta">
                        {offer.price && (
                          <span className="price">
                            {offer.price} {offer.currency}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                </a>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
