import type { DerivedTotals } from "../schema";

export function lookupDerivedValue(derived: DerivedTotals, computeKey: string | undefined): number | string {
  if (!computeKey) {
    return "";
  }

  switch (computeKey) {
    case "gross_monthly_income":
      return derived.gross_monthly_income;
    case "net_monthly_income":
      return derived.net_monthly_income;
    case "housing_monthly_total":
      return derived.housing.total;
    case "transport_loan_payment_monthly":
      return derived.transportation.loan_payment;
    case "transport_operating_monthly":
      return derived.transportation.operating_cost;
    case "transport_monthly_total":
      return derived.transportation.total;
    case "total_monthly_expenses":
      return derived.total_monthly_expenses;
    case "monthly_surplus":
      return derived.monthly_surplus;
    default:
      return "";
  }
}
