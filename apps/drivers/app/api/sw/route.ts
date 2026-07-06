import { resolveAppVersion } from "@repo/ui/lib/resolve-app-version";

export const dynamic = "force-dynamic";

export function GET() {
  const version = resolveAppVersion(process.env);

  return new Response(
    `const VERSION = ${JSON.stringify(version)};
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));
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
