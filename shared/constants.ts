export const KORA_SUPPORTED_COUNTRIES = [
  "Nigeria",
] as const;

export type KoraSupportedCountry = (typeof KORA_SUPPORTED_COUNTRIES)[number];
