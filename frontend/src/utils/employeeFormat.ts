const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatSalaryUsd = (value: string): string => usd.format(Number(value));

export const displayHireDate = (value: string): string => value;
