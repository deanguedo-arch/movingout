import type { Constants, DerivedTotals, ExpenseTableRow, FoodTableRow, InputMap } from "../schema";
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

function getStringInput(inputs: InputMap, fieldId: string): string {
  const value = inputs[fieldId];
  return typeof value === "string" ? value : "";
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

function getIncomeMode(
  inputs: InputMap,
  constants: Constants,
): "net_paycheque" | "hourly_estimate" {
  const raw = getStringInput(inputs, "income_mode");
  if (raw === "hourly_estimate") {
    return "hourly_estimate";
  }
  if (raw === "net_paycheque") {
    return "net_paycheque";
  }
  return constants.income.default_mode;
}

function interpolateLoanPayment(
  points: Constants["transportation"]["loan_payment_table"]["points"],
  principal: number,
): number {
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

function calculateDeductionBreakdown(args: {
  gross: number;
  net: number;
  constants: Constants;
}): DerivedTotals["deductions"] {
  const { gross, net, constants } = args;
  const rates = constants.deductions;
  const totalRate =
    rates.income_tax_rate.value +
    rates.cpp_rate.value +
    rates.ei_rate.value +
    rates.union_dues_rate.value;

  const deductionTotal = roundCurrency(Math.max(gross - net, 0));
  if (deductionTotal <= 0 || totalRate <= 0) {
    return {
      income_tax: 0,
      cpp: 0,
      ei: 0,
      union_dues: 0,
      total: 0,
    };
  }

  const incomeTax = roundCurrency((deductionTotal * rates.income_tax_rate.value) / totalRate);
  const cpp = roundCurrency((deductionTotal * rates.cpp_rate.value) / totalRate);
  const ei = roundCurrency((deductionTotal * rates.ei_rate.value) / totalRate);
  const unionDues = roundCurrency(
    deductionTotal - incomeTax - cpp - ei,
  );

  return {
    income_tax: incomeTax,
    cpp,
    ei,
    union_dues: unionDues,
    total: roundCurrency(incomeTax + cpp + ei + unionDues),
  };
}

export function computeGrossMonthlyIncome(args: { inputs: InputMap; constants: Constants }): number {
  const { inputs, constants } = args;
  const mode = getIncomeMode(inputs, constants);
  const otherIncome = getNumberInput(inputs, "other_monthly_income");

  if (mode === "hourly_estimate") {
    const wage = getNumberInput(inputs, "hourly_wage");
    const hours = getNumberInput(inputs, "hours_per_week");
    return roundCurrency(wage * hours * constants.transportation.weeks_per_month.value + otherIncome);
  }

  const wage = getNumberInput(inputs, "hourly_wage");
  const hours = getNumberInput(inputs, "hours_per_week");
  if (wage > 0 && hours > 0) {
    return roundCurrency(wage * hours * constants.transportation.weeks_per_month.value + otherIncome);
  }

  const netPerCheque = getNumberInput(inputs, "net_pay_per_cheque");
  const chequesPerMonth = Math.max(getNumberInput(inputs, "paycheques_per_month"), 1);
  const netEmployment = netPerCheque * chequesPerMonth;
  const estimatedRate =
    constants.deductions.income_tax_rate.value +
    constants.deductions.cpp_rate.value +
    constants.deductions.ei_rate.value +
    constants.deductions.union_dues_rate.value;
  if (estimatedRate <= 0 || estimatedRate >= 1) {
    return roundCurrency(netEmployment + otherIncome);
  }
  return roundCurrency(netEmployment / (1 - estimatedRate) + otherIncome);
}

export function parseFoodTableRows(args: {
  inputs: InputMap;
  constants: Constants;
}): FoodTableRow[] {
  const { inputs, constants } = args;
  const raw = inputs.food_table_weekly;
  const fallback = constants.food.default_items.map((item, index) => ({
    id: `default-${index + 1}`,
    item,
    planned_purchase: "",
    estimated_cost: 0,
    source_url: "",
  }));

  if (typeof raw !== "string" || raw.trim().length === 0) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as FoodTableRow[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return fallback;
    }
    return parsed.map((row, index) => ({
      id: typeof row.id === "string" && row.id.length > 0 ? row.id : `row-${index + 1}`,
      item: typeof row.item === "string" ? row.item : "",
      planned_purchase: typeof row.planned_purchase === "string" ? row.planned_purchase : "",
      estimated_cost:
        typeof row.estimated_cost === "number" && Number.isFinite(row.estimated_cost)
          ? row.estimated_cost
          : 0,
      source_url: typeof row.source_url === "string" ? row.source_url : "",
    }));
  } catch {
    return fallback;
  }
}

export function parseExpenseTableRows(args: {
  inputs: InputMap;
  fieldId: string;
}): ExpenseTableRow[] {
  const { inputs, fieldId } = args;
  const raw = inputs[fieldId];
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as ExpenseTableRow[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((row, index) => {
      const quantityPerYear =
        typeof row.quantity_per_year === "number" && Number.isFinite(row.quantity_per_year)
          ? row.quantity_per_year
          : 0;
      const averageCost =
        typeof row.average_cost === "number" && Number.isFinite(row.average_cost)
          ? row.average_cost
          : 0;
      const annualTotal =
        typeof row.annual_total === "number" && Number.isFinite(row.annual_total)
          ? row.annual_total
          : 0;
      const monthlyTotal =
        typeof row.monthly_total === "number" && Number.isFinite(row.monthly_total)
          ? row.monthly_total
          : 0;
      return {
        id: typeof row.id === "string" && row.id.length > 0 ? row.id : `row-${index + 1}`,
        item: typeof row.item === "string" ? row.item : "",
        quantity_per_year: quantityPerYear,
        average_cost: averageCost,
        annual_total: annualTotal,
        monthly_total: monthlyTotal,
        source_url: typeof row.source_url === "string" ? row.source_url : "",
      };
    });
  } catch {
    return [];
  }
}

export function computeMonthlyHousingTotals(args: {
  inputs: InputMap;
  netMonthlyIncome: number;
}): DerivedTotals["housing"] {
  const { inputs, netMonthlyIncome } = args;
  const rent = getNumberInput(inputs, "rent_monthly");
  const utilities = getNumberInput(inputs, "utilities_monthly");
  const renterInsurance = getNumberInput(inputs, "renter_insurance_monthly");
  const internetPhone = getNumberInput(inputs, "internet_phone_monthly");
  const other = getNumberInput(inputs, "other_housing_monthly");
  const total = fromCents(sumCents([rent, utilities, renterInsurance, internetPhone, other]));
  const affordabilityRatio = netMonthlyIncome > 0 ? roundCurrency((rent + utilities) / netMonthlyIncome) : 0;

  return {
    rent: roundCurrency(rent),
    utilities: roundCurrency(utilities),
    renter_insurance: roundCurrency(renterInsurance),
    internet_phone: roundCurrency(internetPhone),
    other: roundCurrency(other),
    total,
    affordability_ratio: affordabilityRatio,
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

  const kmPerMonth = getNumberInput(inputs, "km_per_month");
  const fuelEconomy = getNumberInput(inputs, "fuel_economy_l_per_100km");
  const gasPrice = getNumberInput(inputs, "gas_price_per_litre");
  const maintenance = getNumberInput(inputs, "maintenance_monthly");
  const fuelCost =
    mode === "transit"
      ? 0
      : roundCurrency((kmPerMonth * fuelEconomy * gasPrice) / 100);
  const operatingCost = mode === "transit" ? 0 : roundCurrency(fuelCost + maintenance);

  const enteredTransitPass = getNumberInput(inputs, "transit_monthly_pass");
  const transitPass =
    mode === "transit"
      ? enteredTransitPass > 0
        ? enteredTransitPass
        : constants.transportation.transit_monthly_pass_default.value
      : 0;
  const insurance = getNumberInput(inputs, "transport_insurance_monthly");
  const parking = getNumberInput(inputs, "parking_monthly");

  const total = fromCents(
    sumCents([loanPayment, operatingCost, transitPass, insurance, parking]),
  );

  return {
    mode,
    vehicle_price: roundCurrency(vehiclePrice),
    down_payment: roundCurrency(mode === "transit" ? 0 : downPayment),
    financed_principal: roundCurrency(mode === "transit" ? 0 : financedPrincipal),
    term_months: roundCurrency(mode === "transit" ? 0 : termMonths),
    apr_percent: roundCurrency(mode === "transit" ? 0 : aprPercent),
    loan_payment: roundCurrency(loanPayment),
    fuel_economy_l_per_100km: roundCurrency(mode === "transit" ? 0 : fuelEconomy),
    gas_price_per_litre: roundCurrency(mode === "transit" ? 0 : gasPrice),
    km_per_month: roundCurrency(mode === "transit" ? 0 : kmPerMonth),
    fuel_cost: roundCurrency(fuelCost),
    maintenance: roundCurrency(mode === "transit" ? 0 : maintenance),
    operating_cost: roundCurrency(operatingCost),
    insurance: roundCurrency(insurance),
    parking: roundCurrency(parking),
    transit_pass: roundCurrency(transitPass),
    total,
  };
}

function computeLivingExpenses(args: {
  inputs: InputMap;
  constants: Constants;
}): DerivedTotals["living_expenses"] {
  const { inputs, constants } = args;
  const foodRows = parseFoodTableRows({ inputs, constants });
  const groceriesWeekly = roundCurrency(
    foodRows.reduce((sum, row) => sum + row.estimated_cost, 0),
  );
  const groceriesMonthly = roundCurrency(
    groceriesWeekly * constants.food.weeks_per_month.value,
  );
  const clothingRows = parseExpenseTableRows({
    inputs,
    fieldId: "clothing_table_annual",
  });
  const clothingAnnualTotal = roundCurrency(
    clothingRows.reduce((sum, row) => {
      const computedAnnual =
        (row.quantity_per_year ?? 0) > 0 && (row.average_cost ?? 0) > 0
          ? (row.quantity_per_year ?? 0) * (row.average_cost ?? 0)
          : 0;
      const annual = Math.max(computedAnnual, row.annual_total ?? 0);
      return sum + annual;
    }, 0),
  );
  const clothingFromTable = roundCurrency(clothingAnnualTotal / 12);
  const clothingLegacy = getNumberInput(inputs, "clothing_monthly");
  const clothing =
    clothingRows.length > 0 || clothingLegacy <= 0 ? clothingFromTable : roundCurrency(clothingLegacy);

  const householdMaintenance = getNumberInput(inputs, "household_maintenance_monthly");

  const healthRows = parseExpenseTableRows({
    inputs,
    fieldId: "health_hygiene_table_annual",
  });
  const healthFromTable = roundCurrency(
    healthRows.reduce((sum, row) => {
      const monthlyFromAnnual = roundCurrency((row.annual_total ?? 0) / 12);
      return sum + Math.max(monthlyFromAnnual, row.monthly_total ?? 0);
    }, 0),
  );
  const healthLegacy = getNumberInput(inputs, "health_hygiene_monthly");
  const healthHygiene =
    healthRows.length > 0 || healthLegacy <= 0 ? healthFromTable : roundCurrency(healthLegacy);

  const recreationRows = parseExpenseTableRows({
    inputs,
    fieldId: "recreation_table_annual",
  });
  const recreationFromTable = roundCurrency(
    recreationRows.reduce((sum, row) => {
      const monthlyFromAnnual = roundCurrency((row.annual_total ?? 0) / 12);
      return sum + Math.max(monthlyFromAnnual, row.monthly_total ?? 0);
    }, 0),
  );
  const recreationLegacy = getNumberInput(inputs, "recreation_monthly");
  const recreation =
    recreationRows.length > 0 || recreationLegacy <= 0
      ? recreationFromTable
      : roundCurrency(recreationLegacy);

  const savings = getNumberInput(inputs, "savings_monthly");

  const miscRows = parseExpenseTableRows({
    inputs,
    fieldId: "misc_table_monthly",
  });
  const miscFromTable = roundCurrency(
    miscRows.reduce((sum, row) => sum + (row.monthly_total ?? 0), 0),
  );
  const miscLegacy = getNumberInput(inputs, "misc_monthly");
  const misc = miscRows.length > 0 || miscLegacy <= 0 ? miscFromTable : roundCurrency(miscLegacy);

  const total = fromCents(
    sumCents([
      groceriesMonthly,
      clothing,
      householdMaintenance,
      healthHygiene,
      recreation,
      savings,
      misc,
    ]),
  );

  return {
    groceries_weekly: groceriesWeekly,
    groceries: groceriesMonthly,
    clothing: roundCurrency(clothing),
    household_maintenance: roundCurrency(householdMaintenance),
    health_hygiene: roundCurrency(healthHygiene),
    recreation: roundCurrency(recreation),
    savings: roundCurrency(savings),
    misc: roundCurrency(misc),
    total,
  };
}

export function computeBudget(args: { inputs: InputMap; constants: Constants }): DerivedTotals {
  const { inputs, constants } = args;
  const incomeMode = getIncomeMode(inputs, constants);
  const gross = computeGrossMonthlyIncome({ inputs, constants });
  const grossCents = toCents(gross);

  let net = gross;
  let deductions = {
    income_tax: 0,
    cpp: 0,
    ei: 0,
    union_dues: 0,
    total: 0,
  };

  if (incomeMode === "net_paycheque") {
    const cheques = Math.max(getNumberInput(inputs, "paycheques_per_month"), 1);
    const netPerCheque = getNumberInput(inputs, "net_pay_per_cheque");
    const other = getNumberInput(inputs, "other_monthly_income");
    net = roundCurrency(netPerCheque * cheques + other);
    deductions = calculateDeductionBreakdown({
      gross,
      net,
      constants,
    });
  } else {
    const incomeTax = fromCents(toCents((grossCents / 100) * constants.deductions.income_tax_rate.value));
    const cpp = fromCents(toCents((grossCents / 100) * constants.deductions.cpp_rate.value));
    const ei = fromCents(toCents((grossCents / 100) * constants.deductions.ei_rate.value));
    const unionDues = fromCents(toCents((grossCents / 100) * constants.deductions.union_dues_rate.value));
    const totalDeductions = fromCents(toCents(incomeTax + cpp + ei + unionDues));
    net = fromCents(grossCents - toCents(totalDeductions));
    deductions = {
      income_tax: incomeTax,
      cpp,
      ei,
      union_dues: unionDues,
      total: totalDeductions,
    };
  }

  const housing = computeMonthlyHousingTotals({
    inputs,
    netMonthlyIncome: net,
  });
  const transportation = computeTransportation({ inputs, constants });
  const livingExpenses = computeLivingExpenses({ inputs, constants });
  const totalExpenses = fromCents(
    sumCents([housing.total, transportation.total, livingExpenses.total]),
  );
  const monthlySurplus = fromCents(toCents(net - totalExpenses));

  return {
    gross_monthly_income: roundCurrency(gross),
    net_monthly_income: roundCurrency(net),
    deductions,
    housing,
    transportation,
    living_expenses: livingExpenses,
    total_monthly_expenses: totalExpenses,
    monthly_surplus: monthlySurplus,
  };
}
