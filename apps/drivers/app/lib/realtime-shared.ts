import {
  driverNotificationCreatedRealtimeEventSchema,
  driverNotificationReadAllRealtimeEventSchema,
  driverNotificationReadRealtimeEventSchema,
} from "@shared/types";

export type DriverNotificationRealtimeSchema = {
  notification: {
    created: typeof driverNotificationCreatedRealtimeEventSchema;
    read: typeof driverNotificationReadRealtimeEventSchema;
    read_all: typeof driverNotificationReadAllRealtimeEventSchema;
  };
};

export function getDriverNotificationChannel(driverId: string) {
  return `driver:${driverId}`;
}
