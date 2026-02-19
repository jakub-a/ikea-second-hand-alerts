import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { normalizeQuery, parseStoreIdList } from '../../../shared/search-utils.js';

const DEFAULT_STORE_ID = '294'; // Wroclaw (from captured request)
const APP_VERSION = '0.12.1';
const DEBUG_STORAGE_KEY = 'ikea-debug-mode';
const NOTIF_STORAGE_KEY = 'ikea-notifications-enabled';
const HANDLED_NOTIFICATIONS_STORAGE_KEY = 'ikea-handled-notification-ids';

const KNOWN_STORES = [
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

const API_BASE = import.meta.env.VITE_API_BASE || '';
const ALERTS_STORAGE_KEY = 'ikea-alerts';

function loadAlertsFromStorage() {
  try {
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((alert) => {
      const count = Number(alert?.unreadCount);
      return {
        ...alert,
        unreadCount: Number.isFinite(count) ? count : 0
      };
    });
  } catch (err) {
    return [];
  }
}

function saveAlertsToStorage(alerts) {
  localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
}

function loadDebugFlag() {
  try {
    return localStorage.getItem(DEBUG_STORAGE_KEY) === 'true';
  } catch (err) {
    return false;
  }
}

function saveDebugFlag(value) {
  localStorage.setItem(DEBUG_STORAGE_KEY, value ? 'true' : 'false');
}

function loadNotificationFlag() {
  try {
    const value = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (value === null) return null;
    return value === 'true';
  } catch (err) {
    return null;
  }
}

function saveNotificationFlag(value) {
  localStorage.setItem(NOTIF_STORAGE_KEY, value ? 'true' : 'false');
}

function loadHandledNotificationIds() {
  try {
    const raw = localStorage.getItem(HANDLED_NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch (err) {
    return [];
  }
}

function saveHandledNotificationIds(ids) {
  localStorage.setItem(HANDLED_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(ids.slice(-200)));
}

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
  const storeId = offer?.storeId || offer?.storeID || offer?.store || '';
  const storeSlug = KNOWN_STORES.find((store) => store.id === storeId)?.slug;
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
  return { id, title, description, price, originalPrice, discountPercent, currency, image, url, condition, storeId };
}

async function fetchOffers(storeIds, query) {
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
  const res = await fetch(`${API_BASE}/api/items?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load offers');
  const data = await res.json();
  return extractOffers(data).map(normalizeOffer);
}

async function requestPushPermission() {
  if (!('Notification' in window)) throw new Error('Notifications not supported');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permission denied');
  return permission;
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
  if (!('serviceWorker' in navigator)) throw new Error('Service workers not supported');
  const registration = await navigator.serviceWorker.ready;
  if (!registration?.pushManager) throw new Error('Push not supported on this device');
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
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  if (!registration?.pushManager) return;
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
  if (!('serviceWorker' in navigator)) throw new Error('Service workers not supported');
  const registration = await navigator.serviceWorker.ready;
  if (!registration?.pushManager) throw new Error('Push not supported on this device');
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) throw new Error('Enable push alerts first.');

  const res = await fetch(`${API_BASE}/api/test-notification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint })
  });

  if (!res.ok) throw new Error('Failed to send test notification.');
  const data = await res.json();
  return data?.status || 'ok';
}

async function runAlertCheckNow(force = false) {
  const url = force ? `${API_BASE}/api/run-alerts?force=1` : `${API_BASE}/api/run-alerts`;
  const res = await fetch(url, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to run alert check.');
}

async function sendAlertTest(alert) {
  if (!('serviceWorker' in navigator)) throw new Error('Service workers not supported');
  const registration = await navigator.serviceWorker.ready;
  if (!registration?.pushManager) throw new Error('Push not supported on this device');
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) throw new Error('Enable push alerts first.');

  const res = await fetch(`${API_BASE}/api/test-alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint, alert })
  });
  if (!res.ok) throw new Error('Failed to send alert test.');
  const data = await res.json();
  return data?.status || 'ok';
}

async function fetchDebugSubscription() {
  if (!('serviceWorker' in navigator)) throw new Error('Service workers not supported');
  const registration = await navigator.serviceWorker.ready;
  if (!registration?.pushManager) throw new Error('Push not supported on this device');
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) throw new Error('Enable push alerts first.');
  const res = await fetch(
    `${API_BASE}/api/debug-subscription?endpoint=${encodeURIComponent(subscription.endpoint)}`
  );
  if (!res.ok) throw new Error('Failed to load subscription debug.');
  return res.json();
}

async function syncAlertsToServer(alerts) {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await fetch(`${API_BASE}/api/alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint, alerts })
  });
}

function createHoldHandler({ onComplete }) {
  let timer = null;
  let start = 0;
  const duration = 800;

  const startHold = (setProgress) => {
    start = Date.now();
    timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const next = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(next);
      if (next >= 100) {
        clearInterval(timer);
        timer = null;
        onComplete();
      }
    }, 16);
  };

  const stopHold = (setProgress) => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    setProgress(0);
  };

  return { startHold, stopHold };
}

function HoldToggleButton({ active, onToggle }) {
  const [progress, setProgress] = useState(0);
  const { startHold, stopHold } = useMemo(
    () => createHoldHandler({ onComplete: onToggle }),
    [onToggle]
  );

  const label = active ? 'Deactivate' : 'Activate';
  return (
    <button
      type="button"
      className={`hold-button ${active ? 'hold-active' : ''}`}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        event.stopPropagation();
        startHold(setProgress);
      }}
      onMouseUp={(event) => {
        event.stopPropagation();
        stopHold(setProgress);
      }}
      onMouseLeave={() => stopHold(setProgress)}
      onTouchStart={(event) => {
        event.stopPropagation();
        startHold(setProgress);
      }}
      onTouchEnd={(event) => {
        event.stopPropagation();
        stopHold(setProgress);
      }}
      onTouchCancel={() => stopHold(setProgress)}
    >
      <span className="hold-fill" style={{ width: `${progress}%` }} />
      <span className="hold-label">{label}</span>
    </button>
  );
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
  const [activeTab, setActiveTab] = useState('listings');
  const [alerts, setAlerts] = useState(() => loadAlertsFromStorage());
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [didInitFromUrl, setDidInitFromUrl] = useState(false);
  const [debugEvents, setDebugEvents] = useState([]);
  const [debugEnabled, setDebugEnabled] = useState(loadDebugFlag());
  const [notificationsEnabled, setNotificationsEnabled] = useState(loadNotificationFlag());
  const [lastSearch, setLastSearch] = useState(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertNameInput, setAlertNameInput] = useState('');
  const [workerMeta, setWorkerMeta] = useState({ versionId: 'unknown' });
  const userToggledNotificationsRef = useRef(false);
  const handledNotificationsRef = useRef(loadHandledNotificationIds());

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

  const applyAlertBadgeIncrement = useCallback((payload) => {
    const alertId = payload?.alertId;
    const increment = Number(payload?.newCount);
    const notificationId = payload?.notificationId;
    if (!alertId || !(increment > 0)) return;

    if (notificationId && handledNotificationsRef.current.includes(notificationId)) {
      return;
    }

    if (notificationId) {
      handledNotificationsRef.current = [...handledNotificationsRef.current, notificationId].slice(-200);
      saveHandledNotificationIds(handledNotificationsRef.current);
    }

    setAlerts((prev) => {
      const next = prev.map((alert) =>
        alert.id === alertId
          ? { ...alert, unreadCount: (alert.unreadCount || 0) + increment }
          : alert
      );
      saveAlertsToStorage(next);
      return next;
    });
  }, []);

  const storeLabelFor = (id) => {
    const match = stores.find((store) => store.id === id);
    return match ? match.label : 'Unknown store';
  };

  const searchWith = async (storeIds, keywordList) => {
    try {
      setLoading(true);
      setStatus('');
      if (!storeIds || storeIds.length === 0) {
        setStatus('Select at least one store.');
        return;
      }
      if (!keywordList || keywordList.length === 0) {
        setStatus('Add at least one keyword to search.');
        return;
      }
      const query = normalizeQuery(keywordList.join(' '));
      const data = await fetchOffers(storeIds.join(','), query);
      setOffers(data);
      setStatus(`Loaded ${data.length} items.`);
      setLastSearch({ storeIds, keywords: keywordList });
    } catch (err) {
      setStatus(err.message || 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    await searchWith(activeStoreIds, keywords);
  };

  const applyKeywords = async () => {
    const value = normalizeQuery(keywordsInput);
    const list = value ? [value] : [];
    setKeywords(list);
    await searchWith(activeStoreIds, list);
  };

  const openAlertInListings = async (alert) => {
    const nextKeywords = Array.isArray(alert.keywords) ? alert.keywords : [];
    const nextStoreIds = Array.isArray(alert.storeIds) ? alert.storeIds : [];
    setActiveTab('listings');
    setSelectedStoreIds(nextStoreIds);
    setKeywordsInput(nextKeywords.join(' '));
    setKeywords(nextKeywords);
    if (alert?.id) {
      const next = alerts.map((item) =>
        item.id === alert.id ? { ...item, unreadCount: 0 } : item
      );
      setAlerts(next);
      saveAlertsToStorage(next);
    }
    await searchWith(nextStoreIds, nextKeywords);
  };

  const handleSubscribe = async ({ requestPermission = true } = {}) => {
    try {
      setStatus('');
      if (activeStoreIds.length === 0) {
        setStatus('Select at least one store.');
        return;
      }
      if (typeof Notification === 'undefined') {
        setNotificationPermission('unsupported');
        throw new Error('Notifications not supported');
      }
      const currentPermission = Notification.permission;
      if (currentPermission === 'granted') {
        setNotificationPermission('granted');
      } else if (!requestPermission) {
        setNotificationPermission(currentPermission);
        setStatus('Notifications need permission. Toggle off and on to allow.');
        return;
      } else {
        const permission = await requestPushPermission();
        setNotificationPermission(permission);
      }
      setTimeout(() => {
        if (typeof Notification !== 'undefined') {
          setNotificationPermission(Notification.permission);
        }
      }, 300);
      await subscribeToPush({ keywords, storeIds: activeStoreIds });
      setSubscribed(true);
      setStatus('Push alerts enabled.');
      await syncAlertsToServer(alerts);
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

  useEffect(() => {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported');
      return;
    }
    if (Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        setNotificationPermission(permission);
      });
    } else {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready
      .then((registration) => registration?.pushManager?.getSubscription())
      .then((subscription) => {
        setSubscribed(Boolean(subscription));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (notificationsEnabled === null) {
      setNotificationsEnabled(true);
      saveNotificationFlag(true);
      return;
    }
    if (notificationsEnabled) {
      const shouldRequest = userToggledNotificationsRef.current;
      userToggledNotificationsRef.current = false;
      handleSubscribe({ requestPermission: shouldRequest });
    } else if (subscribed) {
      handleUnsubscribe();
    }
  }, [notificationsEnabled]);

  useEffect(() => {
    const syncPermission = () => {
      if (typeof Notification === 'undefined') return;
      setNotificationPermission(Notification.permission);
    };
    const syncSubscription = () => {
      if (!('serviceWorker' in navigator)) return;
      navigator.serviceWorker.ready
        .then((registration) => registration?.pushManager?.getSubscription())
        .then((subscription) => {
          setSubscribed(Boolean(subscription));
        })
        .catch(() => {});
    };
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      syncPermission();
      syncSubscription();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/meta`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.versionId) setWorkerMeta({ versionId: data.versionId });
      } catch (err) {
        // Ignore meta errors
      }
    };
    fetchMeta();
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const handler = (event) => {
      if (!event?.data) return;
      if (event.data?.type === 'push') {
        applyAlertBadgeIncrement(event.data?.payload);
      }
      setDebugEvents((prev) => [
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          data: event.data
        },
        ...prev
      ].slice(0, 10));
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [applyAlertBadgeIncrement]);

  useEffect(() => {
    if (didInitFromUrl) return;
    const params = new URLSearchParams(window.location.search);
    if (params.toString().length === 0) {
      setDidInitFromUrl(true);
      return;
    }

    let nextStores = [];
    let nextKeywords = [];
    let openedAlertId = null;
    const tabParam = params.get('tab');
    const shouldOpenAlerts = tabParam === 'alerts';

    const alertId = params.get('alertId');
    const newCount = params.get('newCount');
    const notificationId = params.get('notificationId');
    if (alertId && newCount) {
      applyAlertBadgeIncrement({
        alertId,
        newCount: Number(newCount),
        notificationId
      });
    }

    if (alertId && !shouldOpenAlerts) {
      const match = alerts.find((alert) => alert.id === alertId);
      if (match) {
        nextStores = match.storeIds || [];
        nextKeywords = match.keywords || [];
        openedAlertId = match.id;
      }
    }

    if (nextStores.length === 0) {
      const storesParam = params.get('stores');
      if (storesParam) nextStores = storesParam.split(',').map((s) => s.trim()).filter(Boolean);
    }

    if (nextKeywords.length === 0) {
      const keywordsParam = params.get('keywords');
      if (keywordsParam) nextKeywords = keywordsParam.split(',').map((k) => k.trim()).filter(Boolean);
    }

    if (nextStores.length > 0) {
      setSelectedStoreIds(nextStores);
    }
    if (nextKeywords.length > 0) {
      setKeywords(nextKeywords);
      setKeywordsInput(nextKeywords.join(', '));
    }
    if (shouldOpenAlerts) {
      setActiveTab('alerts');
    } else if (nextStores.length > 0 && nextKeywords.length > 0) {
      setActiveTab('listings');
      searchWith(nextStores, nextKeywords);
    }

    if (openedAlertId) {
      const next = alerts.map((alert) =>
        alert.id === openedAlertId ? { ...alert, unreadCount: 0 } : alert
      );
      setAlerts(next);
      saveAlertsToStorage(next);
    }

    setDidInitFromUrl(true);
  }, [alerts, applyAlertBadgeIncrement, didInitFromUrl]);

  const openAlertModal = () => {
    if (activeStoreIds.length === 0) {
      setStatus('Select at least one store.');
      return;
    }
    if (keywords.length === 0) {
      setStatus('Add at least one keyword before saving an alert.');
      return;
    }
    setAlertNameInput(keywords[0] || '');
    setIsAlertModalOpen(true);
  };

  const saveCurrentSearchAsAlert = () => {
    const name = alertNameInput.trim();
    if (!name) {
      setStatus('Give the alert a name.');
      return;
    }
    const next = [
      ...alerts,
      {
        id: crypto.randomUUID(),
        name,
        keywords,
        storeIds: activeStoreIds,
        active: true,
        unreadCount: 0
      }
    ];
    setAlerts(next);
    saveAlertsToStorage(next);
    syncAlertsToServer(next);
    setStatus('Alert created.');
    setIsAlertModalOpen(false);
  };

  const toggleAlert = (alertId) => {
    const next = alerts.map((alert) =>
      alert.id === alertId ? { ...alert, active: !alert.active } : alert
    );
    setAlerts(next);
    saveAlertsToStorage(next);
    syncAlertsToServer(next);
  };

  const deleteAlert = (alertId) => {
    if (!window.confirm('Delete this alert?')) return;
    const next = alerts.filter((alert) => alert.id !== alertId);
    setAlerts(next);
    saveAlertsToStorage(next);
    syncAlertsToServer(next);
  };

  return (
    <div className="app">
      {activeTab === 'listings' && (
        <header className="hero">
          <div className="hero-copy">
            <p className="eyebrow">IKEA Second-Hand Watch</p>
            <h1>Catch the good stuff before it disappears.</h1>
            <p className="subtitle">
              Track second-hand listings and get push alerts on your phone.
            </p>
            <p className="version">Version {APP_VERSION}</p>
          </div>
        </header>
      )}
      {activeTab === 'alerts' && (
        <div className="page-title">
          <h1>Alerts</h1>
          <span className="version">Version {APP_VERSION}</span>
        </div>
      )}
      {activeTab === 'settings' && (
        <div className="page-title">
          <h1>Settings</h1>
          <span className="version">Version {APP_VERSION}</span>
        </div>
      )}

      {activeTab === 'listings' && (
        <>
          <section className="card">
            
            <h2>Search</h2>
            <div className="helper-row">
              {activeStoreIds.length === 0 ? (
                <span className="helper">None selected</span>
              ) : (
                <div className="store-tags">
                  {activeStoreIds.map((id) => {
                    const store = stores.find((s) => s.id === id);
                    const label = store ? store.label : storeLabelFor(id);
                    return (
                      <span key={id} className="tag">
                        <span className="tag-name">{label}</span>
                        <span className="tag-id">ID: {id}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
         
            <div className="field-row field-row--compact">
              <input
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                placeholder="Enter one IKEA product name, e.g. Trådfri or Billy"
                
              />
              <button className="search-button" onClick={applyKeywords} disabled={loading}>
                {loading ? 'Searching…' : 'Search'}
              </button>
            </div>
          </section>

          {lastSearch && (
            <section className="card results">
              <div className="results-header">
                <h2>Look what I found!</h2>
                <span>
                 I found {filteredOffers.length} items
                </span>
              </div>
              <div className="field-row">
                <button className="ghost" onClick={openAlertModal}>
                  Save alert for this search
                </button>
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
                              <div className="price-stack">
                                {offer.originalPrice && (
                                  <span className="price-original">
                                    {offer.originalPrice} {offer.currency}
                                  </span>
                                )}
                                <div className="price-row">
                                  {offer.price && (
                                    <span className="price">
                                      {offer.price} {offer.currency}
                                    </span>
                                  )}
                                  {offer.discountPercent !== null && offer.discountPercent > 0 && (
                                    <span className="price-discount">-{offer.discountPercent}%</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </article>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {activeTab === 'alerts' && (
        <>
            <div className="results-header">
              <span>{alerts.length} total</span>
            </div>
            {alerts.length === 0 && <p className="helper">No alerts yet.</p>}
            <div className="alert-list">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="alert-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => openAlertInListings(alert)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openAlertInListings(alert);
                    }
                  }}
                >
                  <div className="alert-header">
                    <div className="alert-meta">
                      <div className="alert-title-row">
                        <h3>{alert.name}</h3>
                        {alert.unreadCount > 0 && (
                          <span className="alert-badge">{alert.unreadCount}</span>
                        )}
                      </div>
                      <p className="helper">Stores: {alert.storeIds.join(', ')}</p>
                     
                    </div>
                    <div className="alert-actions">
                      <HoldToggleButton
                        active={alert.active}
                        onToggle={() => toggleAlert(alert.id)}
                      />
                      <button
                        className="subtle"
                        onClick={async (event) => {
                          event.stopPropagation();
                          try {
                            setStatus('');
                            const result = await sendAlertTest(alert);
                            setStatus(`Alert test sent. Status: ${result}`);
                          } catch (err) {
                            setStatus(err.message || 'Failed to send alert test.');
                          }
                        }}
                      >
                        Test
                      </button>
                      <button
                        className="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteAlert(alert.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          
        </>
      )}

      {activeTab === 'settings' && (
        <>
          <section className="card">
            <div className="helper-row">
            <h2>Notifications</h2>
            <p className="helper">
              <span className="badge">{notificationPermission === 'unsupported' ? 'Not supported' : notificationPermission}</span>
            </p>
            </div>
            <div className="toggle-row">
              <div>
                <p className="helper">Alerts notifications</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={Boolean(notificationsEnabled)}
                  onChange={(e) => {
                    const next = e.target.checked;
                    userToggledNotificationsRef.current = true;
                    setNotificationsEnabled(next);
                    saveNotificationFlag(next);
                  }}
                />
                <span className="slider" />
              </label>
            </div>
          </section>
          <section className="card">
            <h2>Stores</h2>
            <p className="helper">Select stores you want to search in.</p>
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
            <div className="toggle-row">
              <div className=''>
                <h2>Debug Mode</h2>
                <p className="helper">Enable extra diagnostics and tools.</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={debugEnabled}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setDebugEnabled(next);
                    saveDebugFlag(next);
                  }}
                />
                <span className="slider" />
              </label>
            </div>
          </section>
          {debugEnabled && (
            <>
              <section className="card">
                <h2>Version</h2>
                <p className="helper">App version: {APP_VERSION}</p>
                <p className="helper">Worker version ID: {workerMeta.versionId}</p>
              </section>
              <section className="card">
                <h2>Debug Tools</h2>
                <div className="field-row">
                  <button
                    className="subtle"
                    onClick={async () => {
                      try {
                        setStatus('');
                        const result = await sendTestNotification();
                        setStatus(`Test notification sent. Status: ${result}`);
                      } catch (err) {
                        setStatus(err.message || 'Failed to send test notification.');
                      }
                    }}
                  >
                    Send Test Notification
                  </button>
                  <button
                    className="subtle"
                    onClick={async () => {
                      try {
                        setStatus('');
                        await runAlertCheckNow();
                        setStatus('Alert check triggered.');
                      } catch (err) {
                        setStatus(err.message || 'Failed to run alert check.');
                      }
                    }}
                  >
                    Run Alert Check
                  </button>
                  <button
                    className="subtle"
                    onClick={async () => {
                      try {
                        setStatus('');
                        await runAlertCheckNow(true);
                        setStatus('Forced alert check triggered.');
                      } catch (err) {
                        setStatus(err.message || 'Failed to run alert check.');
                      }
                    }}
                  >
                    Run Alert Check (Force)
                  </button>
                  <button
                    className="subtle"
                    onClick={async () => {
                      try {
                        setStatus('');
                        const data = await fetchDebugSubscription();
                        setDebugEvents((prev) => [
                          {
                            id: crypto.randomUUID(),
                            timestamp: new Date().toISOString(),
                            data
                          },
                          ...prev
                        ].slice(0, 10));
                        setStatus('Loaded subscription debug.');
                      } catch (err) {
                        setStatus(err.message || 'Failed to load subscription debug.');
                      }
                    }}
                  >
                    Debug Subscription
                  </button>
                </div>
              </section>
              <section className="card">
                <h2>Debug</h2>
                {debugEvents.length === 0 && (
                  <p className="helper">No push events received in this session.</p>
                )}
                <div className="debug-list">
                  {debugEvents.map((event) => (
                    <div key={event.id} className="debug-item">
                      <div className="debug-time">{event.timestamp}</div>
                      <pre>{JSON.stringify(event.data, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}

      {isAlertModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Create Alert</h2>
            <p className="helper">Name this alert for easy access later.</p>
            <label>
              Alert name
              <input
                value={alertNameInput}
                onChange={(e) => setAlertNameInput(e.target.value)}
                placeholder="e.g. Kitchen cabinets"
              />
            </label>
            <div className="field-row">
              <button onClick={saveCurrentSearchAsAlert}>Save Alert</button>
              <button className="ghost" onClick={() => setIsAlertModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {status && <p className="status">{status}</p>}

      <nav className="bottom-nav">
        <button
          type="button"
          className={`nav-item ${activeTab === 'listings' ? 'nav-active' : ''}`}
          onClick={() => setActiveTab('listings')}
        >
          Listings
        </button>
        <button
          type="button"
          className={`nav-item ${activeTab === 'alerts' ? 'nav-active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          Alerts
        </button>
        <button
          type="button"
          className={`nav-item ${activeTab === 'settings' ? 'nav-active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </nav>
    </div>
  );
}
