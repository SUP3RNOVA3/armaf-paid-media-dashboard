export function money(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function integer(value) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function percent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

export function compact(value) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(Number(value || 0));
}
