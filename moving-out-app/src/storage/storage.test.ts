import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { getDefaultConstants } from "../schema";
import type { ReadinessFlags, Submission } from "../schema";
import { computeBudget } from "../rules";
import { appendEvent, listEventLog } from "../logs/eventLog";
import { resetBudgetDb } from "./db";
import {
  getConstantsOverrides,
  getEvidenceFileById,
  getEvidenceItemById,
  getSubmission,
  listEvidenceFilesByEvidenceId,
  saveConstantsOverrides,
  saveEvidenceFile,
  saveEvidenceItem,
  saveSubmission,
} from "./repositories";

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
    hourly_wage: 20,
    hours_per_week: 30,
    other_monthly_income: 100,
    rent_monthly: 900,
    utilities_monthly: 120,
    renter_insurance_monthly: 20,
    internet_phone_monthly: 80,
    other_housing_monthly: 30,
    transport_mode: "car",
    vehicle_price: 12000,
    km_per_week: 100,
    transit_monthly_pass: 0,
    transport_insurance_monthly: 130,
    parking_monthly: 60,
    groceries_monthly: 300,
    health_medical_monthly: 50,
    personal_monthly: 100,
    entertainment_monthly: 80,
    savings_monthly: 150,
    other_expenses_monthly: 40,
  };
  const derived = computeBudget({ inputs, constants });
  return {
    id: "sub-storage-1",
    schema_version: "1.0.0",
    constants_version: "1.0.0",
    student: {
      name: "Storage Student",
      class: "CALM 20",
      teacher: "Teacher",
    },
    inputs,
    reflections: {},
    derived,
    flags: emptyFlags(),
    pinned: [],
    evidence_refs: {},
    updated_at: "2026-02-20T00:00:00.000Z",
  };
}

describe("storage layer", () => {
  beforeEach(async () => {
    await resetBudgetDb();
  });

  afterEach(async () => {
    await resetBudgetDb();
  });

  test("persists submission and constants overrides", async () => {
    const submission = buildSubmission();
    const constants = getDefaultConstants();
    constants.thresholds.buffer_warning_threshold.value = 200;

    await saveSubmission(submission);
    await saveConstantsOverrides(constants);

    const loadedSubmission = await getSubmission();
    const loadedConstants = await getConstantsOverrides();

    expect(loadedSubmission?.id).toBe(submission.id);
    expect(loadedSubmission?.derived.net_monthly_income).toBe(submission.derived.net_monthly_income);
    expect(loadedConstants?.thresholds.buffer_warning_threshold.value).toBe(200);
  });

  test("stores evidence item and blob file records", async () => {
    await saveEvidenceItem({
      id: "ev-1",
      type: "rental_ad",
      url: "https://example.com/rental",
      file_ids: ["file-1"],
      created_at: "2026-02-20T00:00:00.000Z",
    });
    await saveEvidenceFile({
      id: "file-1",
      evidence_id: "ev-1",
      filename: "rental.pdf",
      mime: "application/pdf",
      size: 4,
      sha256: "abcd",
      created_at: "2026-02-20T00:00:00.000Z",
      blob: new Blob(["test"], { type: "application/pdf" }),
    });

    const evidence = await getEvidenceItemById("ev-1");
    const file = await getEvidenceFileById("file-1");
    const byEvidenceId = await listEvidenceFilesByEvidenceId("ev-1");

    expect(evidence?.type).toBe("rental_ad");
    expect(file?.filename).toBe("rental.pdf");
    expect(byEvidenceId).toHaveLength(1);
  });

  test("appends event log entries with monotonic sequence", async () => {
    const first = await appendEvent("FIELD_EDIT", { field_id: "rent_monthly", old: 800, next: 900 }, "2026-02-20T01:00:00.000Z");
    const second = await appendEvent("COMPUTE_RUN", { source: "manual" }, "2026-02-20T01:01:00.000Z");
    const log = await listEventLog();

    expect(first.seq).toBe(1);
    expect(second.seq).toBe(2);
    expect(log.map((entry) => entry.seq)).toEqual([1, 2]);
    expect(log[0].event_type).toBe("FIELD_EDIT");
    expect(log[1].event_type).toBe("COMPUTE_RUN");
  });
});
