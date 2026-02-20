import "fake-indexeddb/auto";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { buildSubmissionZip } from "./exportZip";
import { restoreFromSubmissionZip } from "./importZip";
import { listEventLog } from "../logs/eventLog";
import { computeBudget } from "../rules";
import { getAssignmentSchema, getDefaultConstants } from "../schema";
import type { EvidenceFile, EvidenceItem, EventLogEntry, ReadinessFlags, Submission } from "../schema";
import { resetBudgetDb } from "../storage/db";
import {
  getConstantsOverrides,
  getSubmission,
  listEvidenceFiles,
  listEvidenceItems,
} from "../storage/repositories";

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

function makeSubmission(): Submission {
  const constants = getDefaultConstants();
  const inputs = {
    hourly_wage: 24,
    hours_per_week: 28,
    other_monthly_income: 140,
    housing_option_label: "Studio apartment",
    rent_monthly: 1100,
    utilities_monthly: 170,
    renter_insurance_monthly: 25,
    internet_phone_monthly: 95,
    transport_option_label: "Used Sedan",
    transport_mode: "car",
    vehicle_price: 14000,
    km_per_week: 140,
    transit_monthly_pass: 0,
    transport_insurance_monthly: 170,
    parking_monthly: 75,
    groceries_monthly: 330,
    health_medical_monthly: 55,
    personal_monthly: 100,
    entertainment_monthly: 90,
    savings_monthly: 170,
    other_expenses_monthly: 50,
  };
  return {
    id: "sub-export-1",
    schema_version: "1.0.0",
    constants_version: "1.0.0",
    student: {
      name: "Export Student",
    },
    inputs,
    reflections: {},
    derived: computeBudget({ inputs, constants }),
    flags: emptyFlags(),
    pinned: [
      {
        id: "pin-1",
        category: "housing",
        label: "Studio apartment",
        snapshot: {
          rent_monthly: 1100,
        },
        evidence_ids: ["e1"],
        pinned_at: "2026-02-20T00:00:00.000Z",
      },
    ],
    evidence_refs: {
      rental_ad: ["e1"],
    },
    updated_at: "2026-02-20T00:00:00.000Z",
  };
}

describe("ZIP export/import", () => {
  beforeEach(async () => {
    await resetBudgetDb();
  });

  afterEach(async () => {
    await resetBudgetDb();
  });

  test("export ZIP contains required files and evidence payload", async () => {
    const schema = getAssignmentSchema();
    const constants = getDefaultConstants();
    const submission = makeSubmission();
    const evidenceItems: EvidenceItem[] = [
      {
        id: "e1",
        type: "rental_ad",
        url: "https://example.com/rental",
        file_ids: ["f1"],
        created_at: "2026-02-20T00:00:00.000Z",
      },
    ];
    const evidenceFiles: EvidenceFile[] = [
      {
        id: "f1",
        evidence_id: "e1",
        filename: "rental-proof.pdf",
        mime: "application/pdf",
        size: 4,
        sha256: "1234",
        created_at: "2026-02-20T00:00:00.000Z",
        blob: new Blob(["test"], { type: "application/pdf" }),
      },
    ];
    const eventLog: EventLogEntry[] = [
      {
        seq: 1,
        timestamp: "2026-02-20T00:00:00.000Z",
        event_type: "COMPUTE_RUN",
        payload: {
          source: "test",
        },
      },
    ];

    const zipBlob = await buildSubmissionZip({
      submission,
      schema,
      constants,
      evidenceItems,
      evidenceFiles,
      eventLog,
      generatedAt: "2026-02-20T00:00:00.000Z",
    });
    const zip = await JSZip.loadAsync(zipBlob);
    const names = Object.keys(zip.files).sort();

    expect(names).toContain("submission.json");
    expect(names).toContain("schema.json");
    expect(names).toContain("constants.json");
    expect(names).toContain("event_log.jsonl");
    expect(names).toContain("artifacts/comparison_sheet.html");
    expect(names).toContain("artifacts/summary.json");
    expect(names).toContain("teacher_summary.json");
    expect(names).toContain("evidence/items.json");
    expect(names).toContain("evidence/manifest.json");
    expect(names.some((name) => name.startsWith("evidence/evidence_f1_"))).toBe(true);
  });

  test("import restores submission, evidence, constants, and logs", async () => {
    const schema = getAssignmentSchema();
    const constants = getDefaultConstants();
    constants.thresholds.buffer_warning_threshold.value = 222;
    const submission = makeSubmission();
    const evidenceItems: EvidenceItem[] = [
      {
        id: "e1",
        type: "rental_ad",
        url: "https://example.com/rental",
        file_ids: ["f1"],
        created_at: "2026-02-20T00:00:00.000Z",
      },
    ];
    const evidenceFiles: EvidenceFile[] = [
      {
        id: "f1",
        evidence_id: "e1",
        filename: "rental-proof.pdf",
        mime: "application/pdf",
        size: 4,
        sha256: "1234",
        created_at: "2026-02-20T00:00:00.000Z",
        blob: new Blob(["test"], { type: "application/pdf" }),
      },
    ];
    const eventLog: EventLogEntry[] = [
      {
        seq: 1,
        timestamp: "2026-02-20T00:00:00.000Z",
        event_type: "COMPUTE_RUN",
        payload: {
          source: "test",
        },
      },
    ];

    const zipBlob = await buildSubmissionZip({
      submission,
      schema,
      constants,
      evidenceItems,
      evidenceFiles,
      eventLog,
      generatedAt: "2026-02-20T00:00:00.000Z",
    });
    await restoreFromSubmissionZip(zipBlob);

    const storedSubmission = await getSubmission();
    const storedConstants = await getConstantsOverrides();
    const storedEvidenceItems = await listEvidenceItems();
    const storedEvidenceFiles = await listEvidenceFiles();
    const storedLog = await listEventLog();

    expect(storedSubmission?.id).toBe(submission.id);
    expect(storedConstants?.thresholds.buffer_warning_threshold.value).toBe(222);
    expect(storedEvidenceItems).toHaveLength(1);
    expect(storedEvidenceFiles).toHaveLength(1);
    expect(storedEvidenceFiles[0].filename).toBe("rental-proof.pdf");
    expect(storedLog.map((entry) => entry.event_type)).toEqual(["COMPUTE_RUN", "IMPORT"]);
  });
});
