import type { Constants, DerivedTotals, InputMap } from "../schema";
import { fromCents, roundCurrency, sumCents, toCents } from "./currency";

function getNumberInput(inputs: InputMap, fieldId: string): number {
  const value = inputs[fieldId];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function getMode(inputs: InputMap): "car" | "truck" | "transit" {
  const raw = inputs.transport_mode;
  if (raw === "truck") {
    return "truck";
  }
  if (raw === "transit") {
    return "transit";
  }
  return "car";
}

function interpolateLoanPayment(points: Constants["transportation"]["loan_payment_table"]["points"], principal: number): number {
  if (principal <= 0 || points.length === 0) {
    return 0;
  }

  const sorted = [...points].sort((a, b) => a.principal - b.principal);
  if (principal <= sorted[0].principal) {
    return roundCurrency((principal / sorted[0].principal) * sorted[0].monthly_payment);
  }

  const last = sorted[sorted.length - 1];
  if (principal >= last.principal) {
    const prev = sorted[sorted.length - 2] ?? sorted[0];
    const denominator = last.principal - prev.principal;
    const slope = denominator === 0 ? 0 : (last.monthly_payment - prev.monthly_payment) / denominator;
    return roundCurrency(last.monthly_payment + (principal - last.principal) * slope);
  }

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const left = sorted[i];
    const right = sorted[i + 1];
    if (principal >= left.principal && principal <= right.principal) {
      const span = right.principal - left.principal;
      const ratio = span === 0 ? 0 : (principal - left.principal) / span;
      return roundCurrency(left.monthly_payment + (right.monthly_payment - left.monthly_payment) * ratio);
    }
  }

  return 0;
}

function amortizedPaymentPerDollar(termMonths: number, aprPercent: number): number {
  if (termMonths <= 0) {
    return 0;
  }
  const monthlyRate = aprPercent / 100 / 12;
  if (monthlyRate === 0) {
    return 1 / termMonths;
  }
  const pow = (1 + monthlyRate) ** termMonths;
  return (monthlyRate * pow) / (pow - 1);
}

export function computeVehicleLoanPayment(args: {
  financedPrincipal: number;
  termMonths: number;
  aprPercent: number;
  constants: Constants;
}): number {
  const { financedPrincipal, termMonths, aprPercent, constants } = args;
  if (financedPrincipal <= 0) {
    return 0;
  }

  const table = constants.transportation.loan_payment_table;
  const baselinePayment = interpolateLoanPayment(table.points, financedPrincipal);

  const baselineFactor = amortizedPaymentPerDollar(table.baseline_term_months, table.baseline_apr_percent);
  const targetFactor = amortizedPaymentPerDollar(termMonths, aprPercent);
  if (baselineFactor === 0 || targetFactor === 0) {
    return roundCurrency(baselinePayment);
  }

  return roundCurrency((baselinePayment * targetFactor) / baselineFactor);
}

export function computeGrossMonthlyIncome(args: { inputs: InputMap; constants: Constants }): number {
  const { inputs, constants } = args;
  const wage = getNumberInput(inputs, "hourly_wage");
  const hours = getNumberInput(inputs, "hours_per_week");
  const other = getNumberInput(inputs, "other_monthly_income");
  const weeksPerMonth = constants.transportation.weeks_per_month.value;

  return roundCurrency(wage * hours * weeksPerMonth + other);
}

export function computeMonthlyHousingTotals(inputs: InputMap): DerivedTotals["housing"] {
  const rent = getNumberInput(inputs, "rent_monthly");
  const utilities = getNumberInput(inputs, "utilities_monthly");
  const renterInsurance = getNumberInput(inputs, "renter_insurance_monthly");
  const internetPhone = getNumberInput(inputs, "internet_phone_monthly");
  const other = getNumberInput(inputs, "other_housing_monthly");

  const total = fromCents(sumCents([rent, utilities, renterInsurance, internetPhone, other]));

  return {
    rent: roundCurrency(rent),
    utilities: roundCurrency(utilities),
    renter_insurance: roundCurrency(renterInsurance),
    internet_phone: roundCurrency(internetPhone),
    other: roundCurrency(other),
    total,
  };
}

export function computeTransportation(args: { inputs: InputMap; constants: Constants }): DerivedTotals["transportation"] {
  const { inputs, constants } = args;
  const mode = getMode(inputs);
  const vehiclePrice = getNumberInput(inputs, "vehicle_price");
  const providedDownPayment = getNumberInput(inputs, "vehicle_down_payment_amount");
  const downPayment =
    providedDownPayment > 0
      ? providedDownPayment
      : vehiclePrice * constants.transportation.default_down_payment_fraction.value;
  const termMonthsInput = getNumberInput(inputs, "vehicle_term_months");
  const aprPercentInput = getNumberInput(inputs, "vehicle_apr_percent");
  const termMonths = termMonthsInput > 0 ? termMonthsInput : constants.transportation.default_term_months.value;
  const aprPercent = aprPercentInput > 0 ? aprPercentInput : constants.transportation.default_apr_percent.value;
  const financedPrincipal = Math.max(vehiclePrice - downPayment, 0);

  const loanPayment =
    mode === "transit"
      ? 0
      : computeVehicleLoanPayment({
          financedPrincipal,
          termMonths,
          aprPercent,
          constants,
        });

  const kmPerWeek = getNumberInput(inputs, "km_per_week");
  const kmPerMonth = kmPerWeek * constants.transportation.weeks_per_month.value;
  const costPerKm = constants.transportation.operating_cost_per_km[mode].value;
  const operatingCost = mode === "transit" ? 0 : roundCurrency(kmPerMonth * costPerKm);

  const transitPass = getNumberInput(inputs, "transit_monthly_pass");
  const insurance = getNumberInput(inputs, "transport_insurance_monthly");
  const parking = getNumberInput(inputs, "parking_monthly");

  const total = fromCents(sumCents([loanPayment, operatingCost, transitPass, insurance, parking]));

  return {
    mode,
    vehicle_price: roundCurrency(vehiclePrice),
    down_payment: roundCurrency(mode === "transit" ? 0 : downPayment),
    financed_principal: roundCurrency(mode === "transit" ? 0 : financedPrincipal),
    term_months: roundCurrency(mode === "transit" ? 0 : termMonths),
    apr_percent: roundCurrency(mode === "transit" ? 0 : aprPercent),
    loan_payment: roundCurrency(loanPayment),
    operating_cost: roundCurrency(operatingCost),
    transit_pass: roundCurrency(transitPass),
    insurance: roundCurrency(insurance),
    parking: roundCurrency(parking),
    total,
  };
}

function computeLivingExpenses(inputs: InputMap): DerivedTotals["living_expenses"] {
  const groceries = getNumberInput(inputs, "groceries_monthly");
  const healthMedical = getNumberInput(inputs, "health_medical_monthly");
  const personal = getNumberInput(inputs, "personal_monthly");
  const entertainment = getNumberInput(inputs, "entertainment_monthly");
  const savings = getNumberInput(inputs, "savings_monthly");
  const other = getNumberInput(inputs, "other_expenses_monthly");

  const total = fromCents(sumCents([groceries, healthMedical, personal, entertainment, savings, other]));

  return {
    groceries: roundCurrency(groceries),
    health_medical: roundCurrency(healthMedical),
    personal: roundCurrency(personal),
    entertainment: roundCurrency(entertainment),
    savings: roundCurrency(savings),
    other: roundCurrency(other),
    total,
  };
}

export function computeBudget(args: { inputs: InputMap; constants: Constants }): DerivedTotals {
  const { inputs, constants } = args;
  const gross = computeGrossMonthlyIncome({ inputs, constants });
  const grossCents = toCents(gross);

  const incomeTax = fromCents(toCents((grossCents / 100) * constants.deductions.income_tax_rate.value));
  const cpp = fromCents(toCents((grossCents / 100) * constants.deductions.cpp_rate.value));
  const ei = fromCents(toCents((grossCents / 100) * constants.deductions.ei_rate.value));
  const unionDues = fromCents(toCents((grossCents / 100) * constants.deductions.union_dues_rate.value));
  const totalDeductions = fromCents(toCents(incomeTax + cpp + ei + unionDues));
  const net = fromCents(grossCents - toCents(totalDeductions));

  const housing = computeMonthlyHousingTotals(inputs);
  const transportation = computeTransportation({ inputs, constants });
  const livingExpenses = computeLivingExpenses(inputs);

  const totalExpenses = fromCents(sumCents([housing.total, transportation.total, livingExpenses.total]));
  const monthlySurplus = fromCents(toCents(net - totalExpenses));

  return {
    gross_monthly_income: gross,
    net_monthly_income: net,
    deductions: {
      income_tax: incomeTax,
      cpp,
      ei,
      union_dues: unionDues,
      total: totalDeductions,
    },
    housing,
    transportation,
    living_expenses: livingExpenses,
    total_monthly_expenses: totalExpenses,
    monthly_surplus: monthlySurplus,
  };
}
