const usdFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 5,
})

export function formatUsd(amount: number) {
  return usdFormatter.format(amount)
}
