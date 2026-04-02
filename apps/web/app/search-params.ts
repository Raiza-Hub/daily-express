import { parseAsArrayOf, parseAsString } from "nuqs";

export const searchParams = {
  from: parseAsString,
  to: parseAsString,
  date: parseAsString,
  vehicleType: parseAsArrayOf(parseAsString),
};

export type SearchParams = {
  from: string | null;
  to: string | null;
  date: string | null;
  vehicleType: string[] | null;
};
