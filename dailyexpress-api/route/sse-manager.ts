import type { ServerResponse } from "http";

export interface TripUpdateData {
  tripId: string;
  bookedSeats: number;
  capacity: number;
  vehicleType: string;
  routeId?: string;
}

interface ClientEntry {
  res: ServerResponse;
  lastActiveAt: number;
}

const HEARTBEAT_INTERVAL_MS = 30_000;
const STALE_TIMEOUT_MS = 120_000;

class SSEManager {
  private clients = new Map<ServerResponse, ClientEntry>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  addClient(res: ServerResponse) {
    const entry: ClientEntry = { res, lastActiveAt: Date.now() };
    this.clients.set(res, entry);

    res.on("close", () => {
      this.clients.delete(res);
    });

    this.ensureHeartbeat();
  }

  removeClient(res: ServerResponse) {
    this.clients.delete(res);
  }

  private ensureHeartbeat() {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
      this.removeStaleClients();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private sendHeartbeat() {
    const now = Date.now();
    for (const [res, entry] of this.clients) {
      try {
        res.write(": heartbeat\n\n");
        entry.lastActiveAt = now;
      } catch {
        this.clients.delete(res);
      }
    }
  }

  private removeStaleClients() {
    const now = Date.now();
    for (const [res, entry] of this.clients) {
      if (now - entry.lastActiveAt > STALE_TIMEOUT_MS) {
        try {
          res.end();
        } catch {
          // ignore end errors
        }
        this.clients.delete(res);
      }
    }

    if (this.clients.size === 0 && this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  broadcast(event: string, data: Record<string, unknown>) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [res, entry] of this.clients) {
      try {
        res.write(message);
        entry.lastActiveAt = Date.now();
      } catch {
        this.clients.delete(res);
      }
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}

export const sseManager = new SSEManager();
