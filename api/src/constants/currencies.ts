export const PREFERRED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'CZK'] as const

export type PreferredCurrency = (typeof PREFERRED_CURRENCIES)[number]

export function isPreferredCurrency(value: string): value is PreferredCurrency {
  return (PREFERRED_CURRENCIES as readonly string[]).includes(value)
}
