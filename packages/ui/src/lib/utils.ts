import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type TimeValue = {
  hour: number;
  minute: number;
};

export function dateToTime(date?: Date | string | null) {
  if (!date) return null
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return null
  return { hour: d.getHours(), minute: d.getMinutes() } satisfies TimeValue
}

export function timeToDate(time: TimeValue, baseDate?: Date | null) {
  const date = baseDate ? new Date(baseDate) : new Date()
  date.setHours(time.hour, time.minute, 0, 0)
  return date
}

export function getDuration(departure: Date, arrival: Date) {
  const diffMs = arrival.getTime() - departure.getTime()
  if (!Number.isFinite(diffMs) || diffMs < 0) return "0m"
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

export function formatPrice(
  price: number | string,
  options: {
    currency?: 'USD' | 'EUR' | 'GBP' | 'BDT' | 'NGN'
  } = {}
) {
  const { currency = 'NGN' } = options

  const numericPrice =
    typeof price === 'string' ? parseFloat(price) : price

  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numericPrice)
}