import type {
  AssignmentField,
  AssignmentSchema,
  Constants,
  EvidenceItem,
  ReadinessFlags,
  Submission,
} from "../schema";
import { roundCurrency } from "./currency";

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

function getMissingFieldIds(schema: AssignmentSchema, submission: Submission): string[] {
  const missing: string[] = [];
  const requiredFields = schema.fields.filter((field) => field.required);

  for (const field of requiredFields) {
    if (field.role === "reflection") {
      const reflection = submission.reflections[field.id];
      if (!hasValue(reflection)) {
        missing.push(field.id);
      }
      continue;
    }

    const inputValue = submission.inputs[field.id];
    if (!hasValue(inputValue)) {
      missing.push(field.id);
    }
  }

  return missing;
}

function mapMissingFieldLabels(fields: AssignmentField[], missingFieldIds: string[]): string[] {
  const fieldMap = new Map(fields.map((field) => [field.id, field.label]));
  return missingFieldIds.map((id) => fieldMap.get(id) ?? id);
}

function getMissingEvidence(schema: AssignmentSchema, evidence: EvidenceItem[]): ReadinessFlags["missing_required_evidence"] {
  const missing: ReadinessFlags["missing_required_evidence"] = [];
  for (const requirement of schema.evidence_requirements) {
    if (!requirement.required) {
      continue;
    }
    const matching = evidence.find((item) => item.type === requirement.id);
    const hasUrl = typeof matching?.url === "string" && matching.url.trim().length > 0;
    if (!hasUrl) {
      missing.push(requirement.id);
    }
  }
  return missing;
}

export function computeReadinessFlags(args: {
  schema: AssignmentSchema;
  submission: Submission;
  evidence: EvidenceItem[];
  constants: Constants;
}): ReadinessFlags {
  const { schema, submission, evidence, constants } = args;
  const missingFieldIds = getMissingFieldIds(schema, submission);
  const missingRequiredEvidence = getMissingEvidence(schema, evidence);

  const rentPlusUtilities =
    submission.derived.housing.rent + submission.derived.housing.utilities;
  const affordabilityThreshold =
    constants.thresholds.affordability_housing_fraction_of_net.value *
    submission.derived.net_monthly_income;
  const affordabilityFail = rentPlusUtilities > affordabilityThreshold;

  const deficit = submission.derived.total_monthly_expenses > submission.derived.net_monthly_income;
  const surplusOrDeficitAmount = roundCurrency(submission.derived.monthly_surplus);
  const fragileBuffer =
    surplusOrDeficitAmount < constants.thresholds.buffer_warning_threshold.value;

  const fixNext: string[] = [];
  const missingLabels = mapMissingFieldLabels(schema.fields, missingFieldIds);
  missingLabels.slice(0, 5).forEach((label) => {
    fixNext.push(`Enter: ${label}`);
  });

  if (missingRequiredEvidence.includes("rental_ad")) {
    fixNext.push("Add rental ad URL evidence.");
  }
  if (missingRequiredEvidence.includes("vehicle_ad")) {
    fixNext.push("Add vehicle ad URL evidence.");
  }
  if (affordabilityFail) {
    fixNext.push("Housing is above the affordability target. Revisit rent or utilities.");
  }
  if (deficit) {
    fixNext.push("You are spending more than you earn. Reduce costs or increase income.");
  } else if (fragileBuffer) {
    fixNext.push("Your budget has a low buffer. Add savings room if possible.");
  }

  return {
    missing_required_fields: missingFieldIds,
    missing_required_evidence: missingRequiredEvidence,
    affordability_fail: affordabilityFail,
    deficit,
    fragile_buffer: fragileBuffer,
    surplus_or_deficit_amount: surplusOrDeficitAmount,
    fix_next: fixNext,
  };
}
