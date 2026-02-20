export function toCents(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

export function roundCurrency(value: number): number {
  return fromCents(toCents(value));
}

export function sumCents(values: number[]): number {
  return values.reduce((total, value) => total + toCents(value), 0);
}
