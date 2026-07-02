import type { Response } from "express";
import { logger } from "../utils/logger";

const connections = new Map<string, Set<Response>>();

const KEEPALIVE_INTERVAL_MS = 30_000;

function getDriverConnections(driverId: string): Set<Response> {
  let set = connections.get(driverId);
  if (!set) {
    set = new Set();
    connections.set(driverId, set);
  }
  return set;
}

export function subscribe(driverId: string, res: Response): () => void {
  const set = getDriverConnections(driverId);
  set.add(res);

  logger.debug("sse.subscribed", { driverId, activeConnections: set.size });

  return () => {
    set.delete(res);
    if (set.size === 0) {
      connections.delete(driverId);
    }
    logger.debug("sse.unsubscribed", {
      driverId,
      activeConnections: set.size,
    });
  };
}

export function publish(
  driverId: string,
  eventName: string,
  data: unknown,
): void {
  const set = connections.get(driverId);
  if (!set || set.size === 0) return;

  const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  const dead: Response[] = [];

  for (const res of set) {
    try {
      res.write(message);
    } catch {
      dead.push(res);
    }
  }

  for (const res of dead) {
    set.delete(res);
  }
  if (set.size === 0) {
    connections.delete(driverId);
  }
}

export function startKeepalive(res: Response): NodeJS.Timeout {
  const interval = setInterval(() => {
    try {
      res.write(":keepalive\n\n");
    } catch {
      clearInterval(interval);
    }
  }, KEEPALIVE_INTERVAL_MS);
  return interval;
}

export function sendInitialConnected(res: Response): void {
  res.write("event: connected\ndata: {}\n\n");
}
