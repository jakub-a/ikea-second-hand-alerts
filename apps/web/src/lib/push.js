function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function getActivePushSubscription() {
  if (!('serviceWorker' in navigator)) throw new Error('Service workers not supported');
  const registration = await navigator.serviceWorker.ready;
  if (!registration?.pushManager) throw new Error('Push not supported on this device');
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) throw new Error('Enable push alerts first.');
  return { registration, subscription };
}

export async function requestPushPermission() {
  if (!('Notification' in window)) throw new Error('Notifications not supported');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permission denied');
  return permission;
}

export async function subscribeToPush({ apiBase, keywords, storeIds, vapidKey }) {
  if (!('serviceWorker' in navigator)) throw new Error('Service workers not supported');
  const registration = await navigator.serviceWorker.ready;
  if (!registration?.pushManager) throw new Error('Push not supported on this device');
  if (!vapidKey) throw new Error('Missing VITE_VAPID_PUBLIC_KEY');

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey)
  });

  const res = await fetch(`${apiBase}/api/subscribe`, {
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

export async function unsubscribeFromPush(apiBase) {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  if (!registration?.pushManager) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await fetch(`${apiBase}/api/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint })
  });

  await subscription.unsubscribe();
}

export async function sendTestNotification(apiBase) {
  const { subscription } = await getActivePushSubscription();
  const res = await fetch(`${apiBase}/api/test-notification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint })
  });
  if (!res.ok) throw new Error('Failed to send test notification.');
  const data = await res.json();
  return data?.status || 'ok';
}

export async function runAlertCheckNow(apiBase, force = false) {
  const url = force ? `${apiBase}/api/run-alerts?force=1` : `${apiBase}/api/run-alerts`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to run alert check.');
}

export async function sendAlertTest(apiBase, alert) {
  const { subscription } = await getActivePushSubscription();
  const res = await fetch(`${apiBase}/api/test-alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint, alert })
  });
  if (!res.ok) throw new Error('Failed to send alert test.');
  const data = await res.json();
  return data?.status || 'ok';
}

export async function fetchDebugSubscription(apiBase) {
  const { subscription } = await getActivePushSubscription();
  const res = await fetch(
    `${apiBase}/api/debug-subscription?endpoint=${encodeURIComponent(subscription.endpoint)}`
  );
  if (!res.ok) throw new Error('Failed to load subscription debug.');
  return res.json();
}

export async function syncAlertsToServer(apiBase, alerts) {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  if (!registration?.pushManager) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await fetch(`${apiBase}/api/alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint, alerts })
  });
}
