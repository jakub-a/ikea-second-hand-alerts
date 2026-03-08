const DEBUG_STORAGE_KEY = 'ikea-debug-mode';
const NOTIF_STORAGE_KEY = 'ikea-notifications-enabled';
const HANDLED_NOTIFICATIONS_STORAGE_KEY = 'ikea-handled-notification-ids';
const ALERT_SNAPSHOT_STORAGE_KEY = 'ikea-alert-offer-snapshot-v1';
const ALERTS_STORAGE_KEY = 'ikea-alerts';

export function loadAlertsFromStorage() {
  try {
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((alert) => {
      const count = Number(alert?.unreadCount);
      return {
        ...alert,
        unreadCount: Number.isFinite(count) ? count : 0,
        hasNewItems: Boolean(alert?.hasNewItems)
      };
    });
  } catch (err) {
    return [];
  }
}

export function saveAlertsToStorage(alerts) {
  localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
}

export function loadDebugFlag() {
  try {
    return localStorage.getItem(DEBUG_STORAGE_KEY) === 'true';
  } catch (err) {
    return false;
  }
}

export function saveDebugFlag(value) {
  localStorage.setItem(DEBUG_STORAGE_KEY, value ? 'true' : 'false');
}

export function loadNotificationFlag() {
  try {
    const value = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (value === null) return null;
    return value === 'true';
  } catch (err) {
    return null;
  }
}

export function saveNotificationFlag(value) {
  localStorage.setItem(NOTIF_STORAGE_KEY, value ? 'true' : 'false');
}

export function loadHandledNotificationIds() {
  try {
    const raw = localStorage.getItem(HANDLED_NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch (err) {
    return [];
  }
}

export function saveHandledNotificationIds(ids) {
  localStorage.setItem(HANDLED_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(ids.slice(-200)));
}

export function loadAlertOfferSnapshot() {
  try {
    const raw = localStorage.getItem(ALERT_SNAPSHOT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).map(([alertId, ids]) => [
        alertId,
        Array.isArray(ids) ? ids.filter((item) => typeof item === 'string').slice(0, 200) : []
      ])
    );
  } catch (err) {
    return {};
  }
}

export function saveAlertOfferSnapshot(snapshot) {
  localStorage.setItem(ALERT_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
}
