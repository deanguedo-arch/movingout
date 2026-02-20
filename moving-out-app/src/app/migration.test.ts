import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { ReadinessFlags, Submission } from "../schema";
import { getAssignmentSchema, getDefaultConstants } from "../schema";
import { computeBudget } from "../rules";
import { migrateSubmissionToCurrentSchema } from "./state";

function fixturePath(...parts: string[]): string {
  return path.resolve(process.cwd(), "fixtures", ...parts);
}

function readJsonFixture<T>(...parts: string[]): T {
  const json = readFileSync(fixturePath(...parts), "utf-8");
  return JSON.parse(json) as T;
}

function emptyFlags(): ReadinessFlags {
  return {
    missing_required_fields: [],
    missing_required_evidence: [],
    affordability_fail: false,
    deficit: false,
    fragile_buffer: false,
    low_vehicle_price: false,
    unsourced_categories: [],
    surplus_or_deficit_amount: 0,
    fix_next: [],
  };
}

describe("submission migration", () => {
  test("migrates legacy essentials scalar inputs into 1.2 table fields", () => {
    const schema = getAssignmentSchema();
    const constants = getDefaultConstants();
    const legacy = readJsonFixture<Omit<Submission, "derived" | "flags" | "pinned" | "evidence_refs" | "updated_at">>(
      "submissions",
      "base_submission.json",
    );

    const legacySubmission: Submission = {
      ...legacy,
      derived: computeBudget({
        inputs: legacy.inputs,
        constants,
      }),
      flags: emptyFlags(),
      pinned: [],
      evidence_refs: {},
      updated_at: "2026-02-20T00:00:00.000Z",
    };

    const migrated = migrateSubmissionToCurrentSchema({
      submission: legacySubmission,
      schema,
      constants,
    });

    expect(migrated.schema_version).toBe(schema.schema_version);
    expect(typeof migrated.inputs.clothing_table_annual).toBe("string");
    expect(typeof migrated.inputs.health_hygiene_table_annual).toBe("string");
    expect(typeof migrated.inputs.recreation_table_annual).toBe("string");
    expect(typeof migrated.inputs.misc_table_monthly).toBe("string");

    const clothingRows = JSON.parse(String(migrated.inputs.clothing_table_annual)) as Array<{ annual_total: number }>;
    const healthRows = JSON.parse(String(migrated.inputs.health_hygiene_table_annual)) as Array<{ annual_total: number }>;
    const recreationRows = JSON.parse(String(migrated.inputs.recreation_table_annual)) as Array<{ annual_total: number }>;
    const miscRows = JSON.parse(String(migrated.inputs.misc_table_monthly)) as Array<{ monthly_total: number }>;

    expect(clothingRows[0].annual_total).toBeGreaterThan(0);
    expect(healthRows[0].annual_total).toBeGreaterThan(0);
    expect(recreationRows[0].annual_total).toBeGreaterThan(0);
    expect(miscRows[0].monthly_total).toBeGreaterThan(0);

    const legacyDerived = computeBudget({
      inputs: legacySubmission.inputs,
      constants,
    });
    const migratedDerived = computeBudget({
      inputs: migrated.inputs,
      constants,
    });

    expect(migratedDerived.living_expenses.clothing).toBe(legacyDerived.living_expenses.clothing);
    expect(migratedDerived.living_expenses.health_hygiene).toBe(legacyDerived.living_expenses.health_hygiene);
    expect(migratedDerived.living_expenses.recreation).toBe(legacyDerived.living_expenses.recreation);
    expect(migratedDerived.living_expenses.misc).toBe(legacyDerived.living_expenses.misc);
    expect(migratedDerived.living_expenses.total).toBe(legacyDerived.living_expenses.total);
  });
});
