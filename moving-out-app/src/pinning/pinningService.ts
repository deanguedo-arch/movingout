import { lookupDerivedValue } from "../app/derivedLookup";
import type { AssignmentSchema, PinnedChoice, Submission } from "../schema";

function getFieldValue(args: {
  fieldId: string;
  schema: AssignmentSchema;
  submission: Submission;
}): unknown {
  const { fieldId, schema, submission } = args;
  const field = schema.fields.find((entry) => entry.id === fieldId);
  if (!field) {
    return undefined;
  }
  if (field.role === "derived") {
    return lookupDerivedValue(submission.derived, field.compute_key);
  }
  if (field.role === "reflection") {
    return submission.reflections[field.id];
  }
  return submission.inputs[field.id];
}

function getEvidenceIdsForCategory(submission: Submission, category: "housing" | "transportation"): string[] {
  if (category === "housing") {
    return submission.evidence_refs.rental_ad ?? [];
  }
  return submission.evidence_refs.vehicle_ad ?? [];
}

export function createPinnedChoice(args: {
  category: "housing" | "transportation";
  schema: AssignmentSchema;
  submission: Submission;
}): PinnedChoice {
  const { category, schema, submission } = args;
  const config = schema.pinning.categories.find((entry) => entry.id === category);
  if (!config) {
    throw new Error(`Pinning category "${category}" is missing from schema.`);
  }

  const snapshot: Record<string, unknown> = {};
  config.snapshot_field_ids.forEach((fieldId) => {
    snapshot[fieldId] = getFieldValue({ fieldId, schema, submission });
  });
  snapshot.affordability_fail = submission.flags.affordability_fail;
  snapshot.deficit = submission.flags.deficit;
  snapshot.fragile_buffer = submission.flags.fragile_buffer;

  const labelValue = getFieldValue({
    fieldId: config.label_field_id,
    schema,
    submission,
  });

  return {
    id: crypto.randomUUID(),
    category,
    label: String(labelValue ?? `${category} choice`),
    snapshot,
    evidence_ids: getEvidenceIdsForCategory(submission, category),
    pinned_at: new Date().toISOString(),
  };
}

export function applyPinnedChoice(args: {
  submission: Submission;
  pinnedChoice: PinnedChoice;
}): Submission {
  const { submission, pinnedChoice } = args;
  const nextPinned = [
    ...submission.pinned.filter((item) => item.category !== pinnedChoice.category),
    pinnedChoice,
  ];
  return {
    ...submission,
    pinned: nextPinned,
    updated_at: new Date().toISOString(),
  };
}

export function removePinnedChoice(args: {
  submission: Submission;
  category: "housing" | "transportation";
}): Submission {
  const { submission, category } = args;
  const nextPinned = submission.pinned.filter((item) => item.category !== category);
  return {
    ...submission,
    pinned: nextPinned,
    updated_at: new Date().toISOString(),
  };
}
