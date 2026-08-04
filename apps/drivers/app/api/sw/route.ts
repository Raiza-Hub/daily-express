import { resolveAppVersion } from "@repo/ui/lib/resolve-app-version";

export const dynamic = "force-dynamic";

export function GET() {
  const version = resolveAppVersion(process.env);

  return new Response(
    `const VERSION = ${JSON.stringify(version)};
self.addEventListener("install", (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    await clients.claim();
    const windowClients = await clients.matchAll({ type: "window" });
    for (const client of windowClients) {
      client.postMessage({ type: "VERSION", version: VERSION });
    }
  })());
});
self.addEventListener("message", (e) => {
  if (e.data?.type === "GET_VERSION") {
    e.source?.postMessage({ type: "VERSION", version: VERSION });
  }
});`,
    {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
        "Service-Worker-Allowed": "/",
      },
    }
  );
}
