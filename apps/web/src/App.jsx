import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { normalizeQuery } from '../../../shared/search-utils.js';
import { Agentation } from 'agentation';
import {
  Armchair,
  Bell,
  BellRing,
  Cable,
  CookingPot,
  ExternalLink,
  Lamp,
  RockingChair,
  Search,
  SlidersHorizontal,
  Sofa,
  Store,
  Tag
} from 'lucide-react';
import {
  APP_VERSION,
  API_BASE,
  DEFAULT_STORE_ID,
  EMPTY_STATE_ARTWORK_SRC,
  EMPTY_STATE_SEARCH_ICON_SRC,
  EMPTY_STATE_SQUIGGLE_LEFT_SRC,
  EMPTY_STATE_SQUIGGLE_RIGHT_SRC,
  EMPTY_STATE_SQUIGGLE_SMALL_SRC,
  EMPTY_STATE_SQUIGGLE_TOP_LEFT_SRC,
  KNOWN_STORES
} from './constants.js';
import {
  loadAlertOfferSnapshot,
  loadAlertsFromStorage,
  loadDebugFlag,
  loadHandledNotificationIds,
  loadNotificationFlag,
  saveAlertOfferSnapshot,
  saveAlertsToStorage,
  saveDebugFlag,
  saveHandledNotificationIds,
  saveNotificationFlag
} from './lib/storage.js';
import { fetchOffers, sortOffersNewestFirst } from './lib/offers.js';
import {
  fetchDebugSubscription,
  requestPushPermission,
  runAlertCheckNow,
  sendAlertTest,
  sendTestNotification,
  subscribeToPush,
  syncAlertsToServer,
  unsubscribeFromPush
} from './lib/push.js';
import { HoldToggleButton } from './components/HoldToggleButton.jsx';

export default function App() {
  const shouldRenderAgentation =
    import.meta.env.DEV &&
    import.meta.env.MODE !== 'test';
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
  const didRunStartupNewnessCheckRef = useRef(false);
  const appAndWorkerVersion = `App ${APP_VERSION} · Worker ${workerMeta.versionId}`;
  const isListingsEmpty = activeTab === 'listings' && !lastSearch;

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
          ? { ...alert, unreadCount: (alert.unreadCount || 0) + increment, hasNewItems: true }
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
  const hasUnreadAlerts = alerts.some((alert) => (Number(alert?.unreadCount) || 0) > 0);

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
      const data = await fetchOffers({
        apiBase: API_BASE,
        stores: KNOWN_STORES,
        storeIds: storeIds.join(','),
        query
      });
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
        item.id === alert.id ? { ...item, unreadCount: 0, hasNewItems: false } : item
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
      await subscribeToPush({
        apiBase: API_BASE,
        keywords,
        storeIds: activeStoreIds,
        vapidKey: import.meta.env.VITE_VAPID_PUBLIC_KEY
      });
      setSubscribed(true);
      setStatus('Push alerts enabled.');
      await syncAlertsToServer(API_BASE, alerts);
    } catch (err) {
      setStatus(err.message || 'Failed to enable alerts');
    }
  };

  const handleUnsubscribe = async () => {
    try {
      setStatus('');
      await unsubscribeFromPush(API_BASE);
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
        const res = await fetch(`${API_BASE}/api/meta?t=${Date.now()}`, {
          cache: 'no-store'
        });
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
    if (didRunStartupNewnessCheckRef.current) return;
    didRunStartupNewnessCheckRef.current = true;
    const activeAlerts = alerts.filter(
      (alert) =>
        alert.active &&
        Array.isArray(alert.storeIds) &&
        alert.storeIds.length > 0 &&
        Array.isArray(alert.keywords) &&
        alert.keywords.length > 0
    );
    if (activeAlerts.length === 0) {
      return;
    }

    let cancelled = false;
    const runStartupDiffCheck = async () => {
      const previousSnapshot = loadAlertOfferSnapshot();
      const nextSnapshot = {};
      const alertResults = await Promise.all(
        activeAlerts.map(async (alert) => {
          try {
            const data = await fetchOffers({
              apiBase: API_BASE,
              stores: KNOWN_STORES,
              storeIds: alert.storeIds.join(','),
              query: normalizeQuery(alert.keywords.join(' '))
            });
            const ids = data.map((item) => String(item.id)).filter(Boolean).slice(0, 200);
            nextSnapshot[alert.id] = ids;
            const previousIds = new Set(previousSnapshot[alert.id] || []);
            const newCount = ids.filter((id) => !previousIds.has(id)).length;
            return { alertId: alert.id, newCount };
          } catch (err) {
            setDebugEvents((prev) => [
              {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                data: {
                  type: 'startup-alert-newness-error',
                  alertId: alert.id,
                  error: err?.message || 'Failed to evaluate startup newness'
                }
              },
              ...prev
            ].slice(0, 10));
            return { alertId: alert.id, error: true };
          }
        })
      );

      if (cancelled) return;
      const resultByAlertId = new Map(alertResults.map((result) => [result.alertId, result]));
      setAlerts((prev) => {
        let changed = false;
        const next = prev.map((alert) => {
          const evaluation = resultByAlertId.get(alert.id);
          if (!evaluation || evaluation.error) return alert;
          const startupNewCount = Number(evaluation.newCount) || 0;
          const nextUnreadCount = Math.max(Number(alert.unreadCount) || 0, startupNewCount);
          const nextHasNewItems = nextUnreadCount > 0;
          if (nextUnreadCount === (Number(alert.unreadCount) || 0) && nextHasNewItems === Boolean(alert.hasNewItems)) {
            return alert;
          }
          changed = true;
          return {
            ...alert,
            unreadCount: nextUnreadCount,
            hasNewItems: nextHasNewItems
          };
        });
        if (changed) saveAlertsToStorage(next);
        return next;
      });

      if (Object.keys(nextSnapshot).length > 0) {
        saveAlertOfferSnapshot(nextSnapshot);
      }
    };

    runStartupDiffCheck();
    return () => {
      cancelled = true;
    };
  }, [alerts]);

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
    if (alertId && Number(newCount) > 0) {
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
        alert.id === openedAlertId ? { ...alert, unreadCount: 0, hasNewItems: false } : alert
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
        unreadCount: 0,
        hasNewItems: false
      }
    ];
    setAlerts(next);
    saveAlertsToStorage(next);
    syncAlertsToServer(API_BASE, next);
    setStatus('Alert created.');
    setIsAlertModalOpen(false);
  };

  const toggleAlert = (alertId) => {
    const next = alerts.map((alert) =>
      alert.id === alertId ? { ...alert, active: !alert.active } : alert
    );
    setAlerts(next);
    saveAlertsToStorage(next);
    syncAlertsToServer(API_BASE, next);
  };

  const deleteAlert = (alertId) => {
    if (!window.confirm('Delete this alert?')) return;
    const next = alerts.filter((alert) => alert.id !== alertId);
    setAlerts(next);
    saveAlertsToStorage(next);
    const snapshot = loadAlertOfferSnapshot();
    if (alertId in snapshot) {
      delete snapshot[alertId];
      saveAlertOfferSnapshot(snapshot);
    }
    syncAlertsToServer(API_BASE, next);
  };

  return (
    <div className={`app${isListingsEmpty ? ' app-empty-listings' : ''}`}>
      {activeTab === 'alerts' && (
        <div className="page-title">
          <h1>Alerts</h1>
          <span className="version">{appAndWorkerVersion}</span>
        </div>
      )}
      {activeTab === 'settings' && (
        <div className="page-title">
          <h1>Settings</h1>
          <span className="version">{appAndWorkerVersion}</span>
        </div>
      )}

      {activeTab === 'listings' && (
        <>
          <section className="card listing-shell">
            <header className="hero hero-listing">
              <div className="hero-copy">
                <div className="hero-title-row">
                  <span className="hero-store-icon-wrap">
                    <Store className="hero-store-icon" size={40} strokeWidth={1.8} />
                  </span>
                  <div>
                    <h1>IKEA As-Is Watch</h1>
                    <p className="subtitle">Great deals on great design.</p>
                  </div>
                </div>
                <div className="hero-icons" aria-hidden="true">
                  <Lamp size={24} strokeWidth={1.8} />
                  <Armchair size={24} strokeWidth={1.8} />
                  <Cable size={24} strokeWidth={1.8} />
                  <Sofa size={24} strokeWidth={1.8} />
                  <RockingChair size={24} strokeWidth={1.8} />
                  <CookingPot size={24} strokeWidth={1.8} />
                </div>
              </div>
              <div className="field-row field-row--compact">
                <input
                  className="search-input"
                  value={keywordsInput}
                  onChange={(e) => setKeywordsInput(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    applyKeywords();
                  }}
                  placeholder="Enter one IKEA product name, e.g. Trådfri or Billy"
                />
                <div className="search-inline-meta" aria-label="Selected stores">
                  {activeStoreIds.slice(0, 2).map((id) => {
                    const store = stores.find((s) => s.id === id);
                    const label = store ? store.label : storeLabelFor(id);
                    return (
                      <span key={id} className="search-chip">
                        <span className="search-chip-name">{label}</span>
                        <span className="search-chip-id">ID:{id}</span>
                      </span>
                    );
                  })}
                </div>
                <button
                  className="search-button"
                  onClick={applyKeywords}
                  disabled={loading}
                  aria-label={loading ? 'Searching' : 'Search'}
                >
                  <Search size={18} strokeWidth={2} />
                </button>
              </div>
            </header>
            {!lastSearch && (
              <div className="listing-empty-state" data-node-id="23:1467">
                <div className="listing-empty-copy-row" data-node-id="23:1516">
                  <img
                    className="listing-empty-search-icon"
                    src={EMPTY_STATE_SEARCH_ICON_SRC}
                    alt=""
                    aria-hidden="true"
                  />
                  <p className="listing-empty-copy" data-node-id="23:1498">
                    Search for something in a store nearby
                  </p>
                </div>
                <div className="listing-empty-artwork" data-node-id="23:1513">
                  <img
                    className="listing-empty-main-image"
                    src={EMPTY_STATE_ARTWORK_SRC}
                    alt=""
                    aria-hidden="true"
                  />
                  <img
                    className="listing-empty-squiggle listing-empty-squiggle-top-left"
                    src={EMPTY_STATE_SQUIGGLE_TOP_LEFT_SRC}
                    alt=""
                    aria-hidden="true"
                  />
                  <img
                    className="listing-empty-squiggle listing-empty-squiggle-left"
                    src={EMPTY_STATE_SQUIGGLE_LEFT_SRC}
                    alt=""
                    aria-hidden="true"
                  />
                  <img
                    className="listing-empty-squiggle listing-empty-squiggle-right"
                    src={EMPTY_STATE_SQUIGGLE_RIGHT_SRC}
                    alt=""
                    aria-hidden="true"
                  />
                  <img
                    className="listing-empty-squiggle listing-empty-squiggle-small"
                    src={EMPTY_STATE_SQUIGGLE_SMALL_SRC}
                    alt=""
                    aria-hidden="true"
                  />
                </div>
                <div className="listing-empty-help" data-node-id="24:1523">
                  <p>How it works: Say you want to buy a specific IKEA product.</p>
                  <p>Set up an alert and get notified when it pops up in the as-is sale.</p>
                  <p>You could even save 50%! Reserve it on the IKEA website and pick up locally.</p>
                  <p>That&apos;s it! Oh, if you just want to browse what&apos;s out there go the Ikea site ↗</p>
                </div>
              </div>
            )}
            {lastSearch && (
              <div className="listing-results">
              <div className="results-header">
                <h4 className="results-title">
                  {filteredOffers.length > 0
                    ? `🎉 Yaay! I found ${filteredOffers.length} item${filteredOffers.length === 1 ? '' : 's'}`
                    : 'Nothing is there this time'}
                </h4>
              </div>
              <div className="save-alert-row save-alert-sticky-row">
                <button className="ghost save-alert-button" onClick={openAlertModal}>
                  <Bell className="save-alert-icon" size={18} strokeWidth={1.8} />
                  <span className="save-alert-label-desktop">Save alert for this search</span>
                  <span className="save-alert-label-mobile">Save alert</span>
                </button>
              </div>
              {filteredOffers.length === 0 && (
                <p className="helper">Nothing is there this time.</p>
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
                          <span
                            className="external-link-indicator"
                            title="Go to Ikea site"
                            aria-label="Go to Ikea site"
                          >
                            <ExternalLink size={14} strokeWidth={2} />
                          </span>
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
              </div>
            )}
          </section>
          <p className="listing-version">
            <span>2026 ©️ Jakub Andrzejewski</span>
            <span>Build with Codex, Figma, Agentation, Chrome MCP</span>
          </p>
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
                        {alert.hasNewItems && (
                          <span className="alert-new-badge">New items ({Math.max(1, Number(alert.unreadCount) || 0)})</span>
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
                            const result = await sendAlertTest(API_BASE, alert);
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
                        const result = await sendTestNotification(API_BASE);
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
                        await runAlertCheckNow(API_BASE);
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
                        await runAlertCheckNow(API_BASE, true);
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
                        const data = await fetchDebugSubscription(API_BASE);
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

      {status && activeTab !== 'listings' && <p className="status">{status}</p>}

      <nav className="bottom-nav">
        <button
          type="button"
          className={`nav-item ${activeTab === 'listings' ? 'nav-active' : ''}`}
          onClick={() => setActiveTab('listings')}
        >
          <Tag size={16} strokeWidth={1.8} />
          Listings
        </button>
        <button
          type="button"
          className={`nav-item ${activeTab === 'alerts' ? 'nav-active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          <BellRing size={16} strokeWidth={1.8} />
          Alerts
          {hasUnreadAlerts && <span className="nav-alert-dot" aria-hidden="true" />}
        </button>
        <button
          type="button"
          className={`nav-item ${activeTab === 'settings' ? 'nav-active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <SlidersHorizontal size={16} strokeWidth={1.8} />
          Settings
        </button>
      </nav>
      {shouldRenderAgentation && <Agentation endpoint="http://127.0.0.1:4747" />}
    </div>
  );
}
