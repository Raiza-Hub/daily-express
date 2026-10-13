import "dotenv/config";
import { tripDispatchService } from "../dispatch/trip-dispatch.service";

const tripId = process.argv[2] ?? "c8c42c56-08b4-4309-a753-3761dbb946a1";

console.log("Triggering advance for trip", tripId);
await tripDispatchService.processJob({ action: "advance", tripId });
console.log("Advance completed for trip", tripId);
process.exit(0);
