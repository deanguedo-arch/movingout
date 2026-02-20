import type {
  AssignmentField,
  AssignmentSchema,
  Constants,
  EvidenceItem,
  ReadinessFlags,
  Submission,
} from "../schema";
import { roundCurrency } from "./currency";
import { parseExpenseTableRows, parseFoodTableRows } from "./compute";

function hasValue(value: unknown): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (typeof value === "boolean") {
    return true;
  }
  return false;
}

function getNumber(value: unknown): number {
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

function mapMissingFieldLabels(fields: AssignmentField[], missingFieldIds: string[]): string[] {
  const fieldMap = new Map(fields.map((field) => [field.id, field.label]));
  return missingFieldIds.map((id) => fieldMap.get(id) ?? id);
}

function isExpenseTableFieldSatisfied(args: {
  fieldId: string;
  submission: Submission;
}): boolean {
  const { fieldId, submission } = args;
  const rows = parseExpenseTableRows({
    inputs: submission.inputs,
    fieldId,
  });

  if (fieldId === "clothing_table_annual") {
    if (rows.length === 0 && getNumber(submission.inputs.clothing_monthly) > 0) {
      return true;
    }
    return rows.some((row) => {
      const annualFromQty = (row.quantity_per_year ?? 0) * (row.average_cost ?? 0);
      return annualFromQty > 0 || (row.annual_total ?? 0) > 0;
    });
  }

  if (fieldId === "health_hygiene_table_annual" || fieldId === "recreation_table_annual") {
    if (
      rows.length === 0 &&
      ((fieldId === "health_hygiene_table_annual" && getNumber(submission.inputs.health_hygiene_monthly) > 0) ||
        (fieldId === "recreation_table_annual" && getNumber(submission.inputs.recreation_monthly) > 0))
    ) {
      return true;
    }
    return rows.some((row) => (row.annual_total ?? 0) > 0 || (row.monthly_total ?? 0) > 0);
  }

  if (fieldId === "misc_table_monthly") {
    if (rows.length === 0 && getNumber(submission.inputs.misc_monthly) > 0) {
      return true;
    }
    return rows.some((row) => (row.monthly_total ?? 0) > 0);
  }

  return rows.some((row) => {
    const annualFromQty = (row.quantity_per_year ?? 0) * (row.average_cost ?? 0);
    return (
      annualFromQty > 0 ||
      (row.annual_total ?? 0) > 0 ||
      (row.monthly_total ?? 0) > 0
    );
  });
}

function getMissingFieldIds(schema: AssignmentSchema, submission: Submission, constants: Constants): string[] {
  const missing = new Set<string>();
  const requiredFields = schema.fields.filter((field) => field.required);

  for (const field of requiredFields) {
    if (field.role === "reflection") {
      const reflection = submission.reflections[field.id];
      if (!hasValue(reflection)) {
        missing.add(field.id);
      }
      continue;
    }

    if (field.type === "food_table") {
      const foodRows = parseFoodTableRows({
        inputs: submission.inputs,
        constants,
      });
      if (!foodRows.some((row) => row.estimated_cost > 0)) {
        missing.add(field.id);
      }
      continue;
    }

    if (field.type === "expense_table") {
      if (
        !isExpenseTableFieldSatisfied({
          fieldId: field.id,
          submission,
        })
      ) {
        missing.add(field.id);
      }
      continue;
    }

    const inputValue = submission.inputs[field.id];
    if (!hasValue(inputValue)) {
      missing.add(field.id);
    }
  }

  const incomeMode = String(submission.inputs.income_mode ?? constants.income.default_mode);
  if (incomeMode === "net_paycheque") {
    if (getNumber(submission.inputs.net_pay_per_cheque) <= 0) {
      missing.add("net_pay_per_cheque");
    }
  } else {
    if (getNumber(submission.inputs.hourly_wage) <= 0) {
      missing.add("hourly_wage");
    }
    if (getNumber(submission.inputs.hours_per_week) <= 0) {
      missing.add("hours_per_week");
    }
  }

  const transportMode = String(submission.inputs.transport_mode ?? "car");
  if (transportMode === "transit") {
    const transitPass = getNumber(submission.inputs.transit_monthly_pass);
    if (transitPass <= 0 && !hasValue(submission.inputs.transit_source_url)) {
      missing.add("transit_monthly_pass");
    }
  } else {
    if (getNumber(submission.inputs.vehicle_price) <= 0) {
      missing.add("vehicle_price");
    }
    if (getNumber(submission.inputs.km_per_month) <= 0) {
      missing.add("km_per_month");
    }
    if (getNumber(submission.inputs.fuel_economy_l_per_100km) <= 0) {
      missing.add("fuel_economy_l_per_100km");
    }
    if (getNumber(submission.inputs.gas_price_per_litre) <= 0) {
      missing.add("gas_price_per_litre");
    }
  }

  return [...missing];
}

function getMissingEvidence(schema: AssignmentSchema, evidence: EvidenceItem[]): ReadinessFlags["missing_required_evidence"] {
  const missing: ReadinessFlags["missing_required_evidence"] = [];
  for (const requirement of schema.evidence_requirements) {
    if (!requirement.required) {
      continue;
    }
    const matching = evidence.find((item) => item.type === requirement.id);
    const hasUrl = typeof matching?.url === "string" && matching.url.trim().length > 0;
    const hasFiles = (matching?.file_ids?.length ?? 0) > 0;
    if (!hasUrl && !hasFiles) {
      missing.push(requirement.id);
    }
  }
  return missing;
}

function computeUnsourcedCategories(args: {
  submission: Submission;
  constants: Constants;
}): string[] {
  const { submission, constants } = args;
  const categories: string[] = [];
  const incomeMode = String(submission.inputs.income_mode ?? constants.income.default_mode);
  if (incomeMode === "net_paycheque" && !hasValue(submission.inputs.net_pay_source_url)) {
    categories.push("income");
  }

  const hasRentSource = hasValue(submission.inputs.rent_source_url);
  const hasUtilitiesSource = hasValue(submission.inputs.utilities_source_url);
  if (!hasRentSource && !hasUtilitiesSource) {
    categories.push("housing");
  }

  const transportMode = String(submission.inputs.transport_mode ?? "car");
  if (transportMode === "transit") {
    if (!hasValue(submission.inputs.transit_source_url)) {
      categories.push("transportation");
    }
  } else if (!hasValue(submission.inputs.vehicle_price_source_url)) {
    categories.push("transportation");
  }

  const foodRows = parseFoodTableRows({
    inputs: submission.inputs,
    constants,
  });
  const foodHasSource = foodRows.some((row) => row.source_url.trim().length > 0);
  const essentialTables = [
    "clothing_table_annual",
    "health_hygiene_table_annual",
    "recreation_table_annual",
    "misc_table_monthly",
  ];
  const essentialsHasSource = essentialTables.some((fieldId) =>
    parseExpenseTableRows({
      inputs: submission.inputs,
      fieldId,
    }).some((row) => row.source_url.trim().length > 0),
  );
  if (!foodHasSource && !essentialsHasSource) {
    categories.push("essentials");
  }

  return categories;
}

export function computeReadinessFlags(args: {
  schema: AssignmentSchema;
  submission: Submission;
  evidence: EvidenceItem[];
  constants: Constants;
}): ReadinessFlags {
  const { schema, submission, evidence, constants } = args;
  const missingFieldIds = getMissingFieldIds(schema, submission, constants);
  const missingRequiredEvidence = getMissingEvidence(schema, evidence);
  const unsourcedCategories = computeUnsourcedCategories({ submission, constants });

  const rentPlusUtilities = submission.derived.housing.rent + submission.derived.housing.utilities;
  const affordabilityThreshold =
    constants.thresholds.affordability_housing_fraction_of_net.value *
    submission.derived.net_monthly_income;
  const affordabilityFail = rentPlusUtilities > affordabilityThreshold;

  const deficit = submission.derived.total_monthly_expenses > submission.derived.net_monthly_income;
  const surplusOrDeficitAmount = roundCurrency(submission.derived.monthly_surplus);
  const fragileBuffer = surplusOrDeficitAmount < constants.thresholds.buffer_warning_threshold.value;
  const transportMode = String(submission.inputs.transport_mode ?? "car");
  const vehiclePrice = getNumber(submission.inputs.vehicle_price);
  const lowVehiclePrice =
    transportMode !== "transit" &&
    vehiclePrice > 0 &&
    vehiclePrice < constants.transportation.minimum_vehicle_price.value;

  const fixNext: string[] = [];
  const missingLabels = mapMissingFieldLabels(schema.fields, missingFieldIds);
  missingLabels.slice(0, 5).forEach((label) => {
    fixNext.push(`Enter: ${label}`);
  });

  if (missingRequiredEvidence.includes("rental_ad")) {
    fixNext.push("Add rental ad evidence (URL or file).");
  }
  if (missingRequiredEvidence.includes("vehicle_ad")) {
    fixNext.push("Add vehicle ad evidence (URL or file).");
  }
  if (unsourcedCategories.length > 0) {
    fixNext.push(`Add sources for: ${unsourcedCategories.join(", ")}.`);
  }
  if (lowVehiclePrice) {
    fixNext.push(`Vehicle price should be at least $${constants.transportation.minimum_vehicle_price.value}.`);
  }
  if (affordabilityFail) {
    fixNext.push("Housing is above the affordability target. Revisit rent or utilities.");
  }
  if (deficit) {
    fixNext.push("You are spending more than you earn. Reduce costs or increase income.");
  } else if (fragileBuffer) {
    fixNext.push("Your budget buffer is low. Try to increase surplus.");
  }

  return {
    missing_required_fields: missingFieldIds,
    missing_required_evidence: missingRequiredEvidence,
    affordability_fail: affordabilityFail,
    deficit,
    fragile_buffer: fragileBuffer,
    low_vehicle_price: lowVehiclePrice,
    unsourced_categories: unsourcedCategories,
    surplus_or_deficit_amount: surplusOrDeficitAmount,
    fix_next: fixNext,
  };
}
