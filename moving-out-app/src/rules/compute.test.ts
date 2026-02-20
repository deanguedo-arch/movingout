import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { getAssignmentSchema, getDefaultConstants } from "../schema";
import type { ReadinessFlags, Submission } from "../schema";
import { computeBudget } from "./compute";
import { computeReadinessFlags } from "./flags";

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
    surplus_or_deficit_amount: 0,
    fix_next: [],
  };
}

describe("rules engine", () => {
  const schema = getAssignmentSchema();
  const constants = getDefaultConstants();
  const baseSubmission = readJsonFixture<Omit<Submission, "derived" | "flags" | "pinned" | "evidence_refs" | "updated_at">>(
    "submissions",
    "base_submission.json",
  );
  const expectedDerived = readJsonFixture<ReturnType<typeof computeBudget>>(
    "expected",
    "base_derived.json",
  );
  const expectedFlags = readJsonFixture<{
    missing_required_fields: string[];
    missing_required_evidence: ("rental_ad" | "vehicle_ad" | "other")[];
    affordability_fail: boolean;
    deficit: boolean;
    fragile_buffer: boolean;
    surplus_or_deficit_amount: number;
  }>("expected", "missing_evidence_flags.json");

  test("computes net income deterministically", () => {
    const derived = computeBudget({
      inputs: baseSubmission.inputs,
      constants,
    });

    expect(derived.gross_monthly_income).toBe(expectedDerived.gross_monthly_income);
    expect(derived.net_monthly_income).toBe(expectedDerived.net_monthly_income);
    expect(derived.deductions).toEqual(expectedDerived.deductions);
  });

  test("computes vehicle loan lookup interpolation and operating cost", () => {
    const derived = computeBudget({
      inputs: baseSubmission.inputs,
      constants,
    });

    expect(derived.transportation.loan_payment).toBe(expectedDerived.transportation.loan_payment);
    expect(derived.transportation.operating_cost).toBe(expectedDerived.transportation.operating_cost);
    expect(derived.transportation.total).toBe(expectedDerived.transportation.total);
  });

  test("affordability warning is raised when rent and utilities exceed threshold", () => {
    const derived = computeBudget({
      inputs: baseSubmission.inputs,
      constants,
    });

    const submission: Submission = {
      ...baseSubmission,
      derived,
      flags: emptyFlags(),
      pinned: [],
      evidence_refs: {},
      updated_at: "2026-02-20T00:00:00.000Z",
    };

    const flags = computeReadinessFlags({
      schema,
      submission,
      evidence: [
        { id: "e1", type: "rental_ad", url: "https://example.com/rent", file_ids: [], created_at: "2026-02-20T00:00:00.000Z" },
        { id: "e2", type: "vehicle_ad", url: "https://example.com/vehicle", file_ids: [], created_at: "2026-02-20T00:00:00.000Z" },
      ],
      constants,
    });

    expect(flags.affordability_fail).toBe(true);
  });

  test("readiness check reports missing required evidence", () => {
    const derived = computeBudget({
      inputs: baseSubmission.inputs,
      constants,
    });

    const submission: Submission = {
      ...baseSubmission,
      derived,
      flags: emptyFlags(),
      pinned: [],
      evidence_refs: {},
      updated_at: "2026-02-20T00:00:00.000Z",
    };

    const flags = computeReadinessFlags({
      schema,
      submission,
      evidence: [],
      constants,
    });

    expect(flags.missing_required_fields).toEqual(expectedFlags.missing_required_fields);
    expect(flags.missing_required_evidence).toEqual(expectedFlags.missing_required_evidence);
    expect(flags.affordability_fail).toBe(expectedFlags.affordability_fail);
    expect(flags.deficit).toBe(expectedFlags.deficit);
    expect(flags.fragile_buffer).toBe(expectedFlags.fragile_buffer);
    expect(flags.surplus_or_deficit_amount).toBe(expectedFlags.surplus_or_deficit_amount);
  });
});
