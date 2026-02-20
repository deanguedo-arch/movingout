import JSZip from "jszip";
import { buildComparisonSheetHtml } from "../artifacts/comparisonSheet";
import type {
  AssignmentSchema,
  Constants,
  EvidenceFile,
  EvidenceItem,
  EventLogEntry,
  Submission,
} from "../schema";

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function toJsonl(entries: EventLogEntry[]): string {
  return `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
}

function computeCompletionPercent(submission: Submission, schema: AssignmentSchema): number {
  const requiredFields = schema.fields.filter((field) => field.required).length;
  const requiredEvidence = schema.evidence_requirements.filter((entry) => entry.required).length;
  const total = requiredFields + requiredEvidence;
  if (total === 0) {
    return 100;
  }
  const missing =
    submission.flags.missing_required_fields.length +
    submission.flags.missing_required_evidence.length;
  return Math.max(0, Math.round(((total - missing) / total) * 100));
}

export async function buildSubmissionZip(args: {
  submission: Submission;
  schema: AssignmentSchema;
  constants: Constants;
  evidenceItems: EvidenceItem[];
  evidenceFiles: EvidenceFile[];
  eventLog: EventLogEntry[];
  generatedAt?: string;
}): Promise<Uint8Array> {
  const { submission, schema, constants, evidenceItems, evidenceFiles, eventLog } = args;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const zip = new JSZip();

  zip.file("submission.json", toJson(submission));
  zip.file("schema.json", toJson(schema));
  zip.file("constants.json", toJson(constants));
  zip.file("event_log.jsonl", toJsonl(eventLog));

  const comparisonHtml = buildComparisonSheetHtml({
    submission,
    constants,
    evidenceItems,
    evidenceFiles,
    generatedAt,
  });
  zip.file("artifacts/comparison_sheet.html", comparisonHtml);
  zip.file(
    "artifacts/summary.json",
    toJson({
      generated_at: generatedAt,
      derived: submission.derived,
      flags: submission.flags,
    }),
  );

  zip.file(
    "teacher_summary.json",
    toJson({
      submission_id: submission.id,
      completion_percent: computeCompletionPercent(submission, schema),
      key_flags: {
        affordability_fail: submission.flags.affordability_fail,
        deficit: submission.flags.deficit,
        fragile_buffer: submission.flags.fragile_buffer,
      },
      pinned_choices: submission.pinned.map((pin) => ({
        category: pin.category,
        label: pin.label,
        pinned_at: pin.pinned_at,
      })),
      evidence_status: schema.evidence_requirements.map((req) => ({
        type: req.id,
        missing: submission.flags.missing_required_evidence.includes(req.id),
      })),
    }),
  );

  zip.file("evidence/items.json", toJson(evidenceItems));

  const manifest = [];
  for (const file of evidenceFiles) {
    const sanitized = sanitizeFilename(file.filename);
    const zipPath = `evidence/evidence_${file.id}_${sanitized}`;
    const bytes = await file.blob.arrayBuffer();
    zip.file(zipPath, bytes);
    manifest.push({
      id: file.id,
      evidence_id: file.evidence_id,
      filename: file.filename,
      mime: file.mime,
      size: file.size,
      sha256: file.sha256,
      created_at: file.created_at,
      zip_path: zipPath,
    });
  }
  zip.file("evidence/manifest.json", toJson(manifest));

  return zip.generateAsync({ type: "uint8array" });
}
