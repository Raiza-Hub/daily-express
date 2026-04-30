const serviceWorkerUrl = new URL(self.location.href);
const apiGatewayUrl =
  serviceWorkerUrl.searchParams.get("apiGatewayUrl") || self.location.origin;

function buildUrl(path) {
  return new URL(path, apiGatewayUrl).toString();
}

function toUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = self.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function fetchJson(path, options) {
  const response = await fetch(buildUrl(path), {
    credentials: "include",
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Request to ${path} failed with ${response.status}`);
  }

  return response.json();
}

async function getVapidPublicKey() {
  const response = await fetchJson(
    "/api/notifications/v1/notifications/push/vapid-public-key",
  );

  if (!response?.success || !response?.data) {
    throw new Error(response?.error || "Failed to fetch VAPID public key");
  }

  return response.data;
}

async function saveSubscription(subscription) {
  const keys = subscription.toJSON().keys || {};

  const response = await fetchJson(
    "/api/notifications/v1/notifications/push/subscribe",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh || "",
        auth: keys.auth || "",
      }),
    },
  );

  if (!response?.success) {
    throw new Error(response?.error || "Failed to save push subscription");
  }
}

async function removeSubscription(endpoint) {
  const response = await fetchJson(
    "/api/notifications/v1/notifications/push/subscribe",
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ endpoint }),
    },
  );

  if (!response?.success) {
    throw new Error(response?.error || "Failed to remove push subscription");
  }
}

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;

  try {
    data = event.data.json();
  } catch (error) {
    console.error("Failed to parse push payload:", error);
    return;
  }

  const options = {
    body: data.message,
    icon: "/logo.png",
    badge: "/logo.png",
    tag: data.tag || "daily-express-notification",
    data: {
      url: data.href || "/",
    },
    vibrate: [200, 100, 200],
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const href = event.notification.data?.url || "/";
  const urlToOpen = new URL(href, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }

        return self.clients.openWindow(urlToOpen);
      }),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const vapidPublicKey = await getVapidPublicKey();
      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toUint8Array(vapidPublicKey),
      });

      const oldEndpoint = event.oldSubscription?.endpoint;

      await saveSubscription(subscription);

      if (oldEndpoint && oldEndpoint !== subscription.endpoint) {
        await removeSubscription(oldEndpoint);
      }
    })().catch((error) => {
      console.error("Failed to resubscribe after pushsubscriptionchange:", error);
    }),
  );
});
