import { describe, expect, test } from "vitest";
import { computeBudget } from "../rules";
import { getAssignmentSchema, getDefaultConstants } from "../schema";
import type { ReadinessFlags, Submission } from "../schema";
import { applyPinnedChoice, createPinnedChoice, removePinnedChoice } from "./pinningService";

function emptyFlags(): ReadinessFlags {
  return {
    missing_required_fields: [],
    missing_required_evidence: [],
    affordability_fail: false,
    deficit: false,
    fragile_buffer: false,
    surplus_or_deficit_amount: 0,
    fix_next: [],
  };
}

function buildSubmission(): Submission {
  const constants = getDefaultConstants();
  const inputs = {
    housing_option_label: "Main Floor Room",
    rent_monthly: 850,
    utilities_monthly: 120,
    renter_insurance_monthly: 20,
    internet_phone_monthly: 90,
    other_housing_monthly: 10,
    transport_option_label: "Used Hatchback",
    transport_mode: "car",
    vehicle_price: 9000,
    km_per_week: 110,
    groceries_monthly: 300,
    health_medical_monthly: 40,
    personal_monthly: 80,
    entertainment_monthly: 70,
    savings_monthly: 150,
  };
  return {
    id: "sub-pin-1",
    schema_version: "1.0.0",
    constants_version: "1.0.0",
    student: {},
    inputs,
    reflections: {},
    derived: computeBudget({ inputs, constants }),
    flags: emptyFlags(),
    pinned: [],
    evidence_refs: {
      rental_ad: ["ev-rental-1"],
      vehicle_ad: ["ev-vehicle-1"],
    },
    updated_at: "2026-02-20T00:00:00.000Z",
  };
}

describe("pinning service", () => {
  const schema = getAssignmentSchema();

  test("creates and applies housing pin with snapshot and evidence refs", () => {
    const submission = buildSubmission();
    const pin = createPinnedChoice({
      category: "housing",
      schema,
      submission,
    });
    const pinnedSubmission = applyPinnedChoice({
      submission,
      pinnedChoice: pin,
    });

    expect(pin.category).toBe("housing");
    expect(pin.label).toContain("Main Floor Room");
    expect(pin.evidence_ids).toEqual(["ev-rental-1"]);
    expect(pin.snapshot.rent_monthly).toBe(850);
    expect(pinnedSubmission.pinned).toHaveLength(1);
  });

  test("removes pin by category", () => {
    const submission = buildSubmission();
    const firstPin = createPinnedChoice({
      category: "housing",
      schema,
      submission,
    });
    const withPin = applyPinnedChoice({
      submission,
      pinnedChoice: firstPin,
    });
    const cleared = removePinnedChoice({
      submission: withPin,
      category: "housing",
    });

    expect(cleared.pinned).toHaveLength(0);
  });
});
