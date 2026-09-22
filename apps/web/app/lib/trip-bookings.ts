import type { PassengerInput } from "@shared/types";

export type BookingStatus =
  | "awaiting_passengers"
  | "awaiting_driver"
  | "driver_accepted"
  | "completed"
  | "refunded"
  | "refund_failed";

export type BookingPassenger = PassengerInput & { id: string };

export interface TripDriver {
  id: string;
  name: string;
  phone: string;
  profileImage?: string | null;
}

export interface TripBooking {
  id: string;
  origin: string;
  destination: string;
  locality: string;
  tripDate: string;
  departureTime: string;
  price: number;
  status: BookingStatus;
  passengers: BookingPassenger[];
  driver?: TripDriver;
}

const passenger = (
  id: string,
  fullName: string,
  email: string,
  phone: string,
  carriesLuggage = false,
): BookingPassenger => ({ id, fullName, email, phone, carriesLuggage });

const driver = (
  id: string,
  name: string,
  phone: string,
  profileImage?: string | null,
): TripDriver => ({ id, name, phone, profileImage: profileImage ?? null });

export const MOCK_BOOKINGS: TripBooking[] = [
  {
    id: "booking-1",
    origin: "Federal University of Agriculture, Abeokuta",
    destination: "Professor Wole Soyinka Station Abeokuta",
    locality: "Ogun State",
    tripDate: "2025-01-14",
    departureTime: "08:00",
    price: 4500,
    status: "awaiting_passengers",
    passengers: [
      passenger("b1-p1", "Adaeze Okafor", "adaeze.okafor@gmail.com", "2348012345678"),
    ],
    driver: driver("d1", "Emeka Nwankwo", "+234 802 555 0103", "https://randomuser.me/api/portraits/men/54.jpg"),
  },
  {
    id: "booking-2",
    origin: "Federal University of Agriculture, Abeokuta",
    destination: "Professor Wole Soyinka Station Abeokuta",
    locality: "Ogun State",
    tripDate: "2025-03-02",
    departureTime: "10:00",
    price: 4500,
    status: "completed",
    passengers: [
      passenger("b2-p1", "Chinedu Nwosu", "chinedu.nwosu@gmail.com", "2348023456789", true),
      passenger("b2-p2", "Folake Adeyemi", "folake.adeyemi@gmail.com", "2348034567890"),
      passenger("b2-p3", "Ibrahim Musa", "ibrahim.musa@gmail.com", "2348045678901"),
      passenger("b2-p4", "Ngozi Eze", "ngozi.eze@gmail.com", "2348056789012"),
    ],
    driver: driver("d2", "Chidi Adeyemi", "+234 803 456 7890", "https://randomuser.me/api/portraits/men/32.jpg"),
  },
  {
    id: "booking-3",
    origin: "Ibadan",
    destination: "Abeokuta",
    locality: "Ogun State",
    tripDate: "2025-09-27",
    departureTime: "12:00",
    price: 3500,
    status: "awaiting_passengers",
    passengers: [
      passenger("b3-p1", "Segun Balogun", "segun.balogun@gmail.com", "2348067890123", true),
      passenger("b3-p2", "Amaka Obi", "amaka.obi@gmail.com", "2348078901234"),
    ],
    driver: driver("d3", "Musa Ibrahim", "+234 805 555 0102"),
  },
  {
    id: "booking-4",
    origin: "Federal University of Agriculture, Abeokuta",
    destination: "Professor Wole Soyinka Station Abeokuta",
    locality: "Ogun State",
    tripDate: "2026-01-08",
    departureTime: "14:00",
    price: 4500,
    status: "awaiting_driver",
    passengers: [
      passenger("b4-p1", "Tunde Bakare", "tunde.bakare@gmail.com", "2348089012345"),
      passenger("b4-p2", "Hauwa Sani", "hauwa.sani@gmail.com", "2348090123456", true),
      passenger("b4-p3", "Emeka Okafor", "emeka.okafor@gmail.com", "2348012345679"),
      passenger("b4-p4", "Blessing Adamu", "blessing.adamu@gmail.com", "2348023456780"),
    ],
  },
  {
    id: "booking-5",
    origin: "Federal University of Agriculture, Abeokuta",
    destination: "Professor Wole Soyinka Station Abeokuta",
    locality: "Ogun State",
    tripDate: "2026-02-19",
    departureTime: "08:00",
    price: 4500,
    status: "driver_accepted",
    passengers: [
      passenger("b5-p1", "Zainab Bello", "zainab.bello@gmail.com", "2348034567891"),
      passenger("b5-p2", "Femi Ajayi", "femi.ajayi@gmail.com", "2348045678902"),
    ],
    driver: driver("d5", "Chidi Adeyemi", "+234 803 456 7890", "https://randomuser.me/api/portraits/men/32.jpg"),
  },
  {
    id: "booking-6",
    origin: "Abeokuta",
    destination: "Ibadan",
    locality: "Oyo State",
    tripDate: "2026-04-03",
    departureTime: "10:00",
    price: 3500,
    status: "refunded",
    passengers: [
      passenger("b6-p1", "Yusuf Adeola", "yusuf.adeola@gmail.com", "2348056789013"),
      passenger("b6-p2", "Chiamaka Uche", "chiamaka.uche@gmail.com", "2348067890124", true),
    ],
    driver: driver("d6", "Kunle Aderemi", "+234 803 555 0101"),
  },
  {
    id: "booking-7",
    origin: "Federal University of Agriculture, Abeokuta",
    destination: "Professor Wole Soyinka Station Abeokuta",
    locality: "Ogun State",
    tripDate: "2026-08-22",
    departureTime: "12:00",
    price: 5000,
    status: "completed",
    passengers: [
      passenger("b7-p1", "Kelechi Onyeka", "kelechi.onyeka@gmail.com", "2348078901235"),
      passenger("b7-p2", "Aisha Lawal", "aisha.lawal@gmail.com", "2348089012346", true),
      passenger("b7-p3", "Danladi Musa", "danladi.musa@gmail.com", "2348090123457"),
    ],
    driver: driver("d7", "Femi Balogun", "+234 806 555 0104"),
  },
  {
    id: "booking-8",
    origin: "Ibadan",
    destination: "Lagos",
    locality: "Lagos State",
    tripDate: "2026-09-30",
    departureTime: "06:00",
    price: 4500,
    status: "refund_failed",
    passengers: [
      passenger("b8-p1", "Gbenga Okon", "gbenga.okon@gmail.com", "2348012345680", true),
    ],
    driver: driver("d8", "Suleiman Yusuf", "+234 807 555 0105"),
  },
];

export const STATUS_LABELS: Record<BookingStatus, string> = {
  awaiting_passengers: "Awaiting passengers",
  awaiting_driver: "Awaiting driver",
  driver_accepted: "Driver accepted",
  completed: "Completed",
  refunded: "Refunded",
  refund_failed: "Refund failed",
};