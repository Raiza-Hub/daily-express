import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Time } from '@internationalized/date'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function dateToTime(date?: Date | string | null) {
  if (!date) return null

  const d = date instanceof Date ? date : new Date(date)

  if (isNaN(d.getTime())) return null

  return new Time(d.getHours(), d.getMinutes())
}
export function timeToDate(time: Time, baseDate?: Date | null) {
  const date = baseDate ? new Date(baseDate) : new Date()
  date.setHours(time.hour, time.minute, 0, 0)
  return date
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