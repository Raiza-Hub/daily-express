import { handle } from "@upstash/realtime";
import type { ApiResponse, Driver } from "@shared/types";
import {
  driverNotificationRealtime,
  getDriverNotificationChannel,
  isDriverNotificationRealtimeConfigured,
} from "~/lib/realtime";
import { env } from "~/env";

const API_GATEWAY_URL = env.NEXT_PUBLIC_API_GATEWAY_URL;

export const dynamic = "force-dynamic";

async function getCurrentDriver(request: Request): Promise<Driver | null> {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  try {
    const response = await fetch(
      `${API_GATEWAY_URL}/api/drivers/v1/driver/profile`,
      {
        headers: {
          Cookie: cookieHeader,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as ApiResponse<Driver>;
    if (!payload.success || !payload.data) {
      return null;
    }

    return payload.data;
  } catch {
    return null;
  }
}

const realtimeGetHandler = driverNotificationRealtime
  ? handle({
      realtime: driverNotificationRealtime,
      middleware: async ({ request, channels }) => {
        const driver = await getCurrentDriver(request);
        if (!driver?.id) {
          return new Response("Unauthorized", { status: 401 });
        }

        const expectedChannel = getDriverNotificationChannel(driver.id);
        for (const channel of channels) {
          if (channel !== expectedChannel) {
            return new Response("Forbidden", { status: 403 });
          }
        }

        return undefined;
      },
    })
  : null;

export async function GET(request: Request) {
  if (!isDriverNotificationRealtimeConfigured || !realtimeGetHandler) {
    return new Response("Realtime not configured", { status: 503 });
  }

  return realtimeGetHandler(request);
}
