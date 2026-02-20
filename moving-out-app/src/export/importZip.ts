import JSZip from "jszip";
import { appendEvent, replaceEventLog } from "../logs/eventLog";
import type {
  AssignmentSchema,
  Constants,
  EvidenceFile,
  EvidenceItem,
  EventLogEntry,
  Submission,
} from "../schema";
import {
  clearConstantsOverrides,
  clearEvidence,
  clearSubmission,
  saveConstantsOverrides,
  saveEvidenceFile,
  saveEvidenceItem,
  saveSubmission,
} from "../storage/repositories";

type ImportResult = {
  submission: Submission;
  schema: AssignmentSchema;
  constants: Constants;
  evidenceItems: EvidenceItem[];
  evidenceFiles: EvidenceFile[];
  eventLog: EventLogEntry[];
};

type EvidenceManifestEntry = {
  id: string;
  evidence_id: string;
  filename: string;
  mime: string;
  size: number;
  sha256: string;
  created_at: string;
  zip_path: string;
};

function parseJson<T>(content: string, filename: string): T {
  try {
    return JSON.parse(content) as T;
  } catch (error) {
    throw new Error(`Invalid JSON in ${filename}: ${(error as Error).message}`);
  }
}

function parseJsonl<T>(content: string): T[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export async function restoreFromSubmissionZip(
  zipBlob: Blob | ArrayBuffer | Uint8Array,
): Promise<ImportResult> {
  const zipInput = zipBlob instanceof Blob ? await zipBlob.arrayBuffer() : zipBlob;
  const zip = await JSZip.loadAsync(zipInput);
  const submissionFile = zip.file("submission.json");
  const schemaFile = zip.file("schema.json");
  const constantsFile = zip.file("constants.json");
  const logFile = zip.file("event_log.jsonl");
  if (!submissionFile || !schemaFile || !constantsFile || !logFile) {
    throw new Error("ZIP is missing one or more required files.");
  }

  const [submissionText, schemaText, constantsText, logText] = await Promise.all([
    submissionFile.async("string"),
    schemaFile.async("string"),
    constantsFile.async("string"),
    logFile.async("string"),
  ]);
  const submission = parseJson<Submission>(submissionText, "submission.json");
  const schema = parseJson<AssignmentSchema>(schemaText, "schema.json");
  const constants = parseJson<Constants>(constantsText, "constants.json");
  const eventLog = parseJsonl<EventLogEntry>(logText);

  const evidenceItemsFile = zip.file("evidence/items.json");
  const evidenceManifestFile = zip.file("evidence/manifest.json");
  const evidenceItems = evidenceItemsFile
    ? parseJson<EvidenceItem[]>(await evidenceItemsFile.async("string"), "evidence/items.json")
    : [];
  const evidenceManifest = evidenceManifestFile
    ? parseJson<EvidenceManifestEntry[]>(
        await evidenceManifestFile.async("string"),
        "evidence/manifest.json",
      )
    : [];

  const evidenceFiles: EvidenceFile[] = [];
  for (const item of evidenceManifest) {
    const blobEntry = zip.file(item.zip_path);
    if (!blobEntry) {
      continue;
    }
    const blob = await blobEntry.async("blob");
    evidenceFiles.push({
      id: item.id,
      evidence_id: item.evidence_id,
      filename: item.filename,
      mime: item.mime,
      size: item.size,
      sha256: item.sha256,
      created_at: item.created_at,
      blob: blob.slice(0, blob.size, item.mime),
    });
  }

  await clearSubmission();
  await clearEvidence();
  await clearConstantsOverrides();
  await saveSubmission(submission);
  await saveConstantsOverrides(constants);
  for (const item of evidenceItems) {
    await saveEvidenceItem(item);
  }
  for (const file of evidenceFiles) {
    await saveEvidenceFile(file);
  }
  await replaceEventLog(eventLog);
  await appendEvent("IMPORT", {
    submission_id: submission.id,
    restored_event_count: eventLog.length,
    restored_evidence_files: evidenceFiles.length,
  });

  return {
    submission,
    schema,
    constants,
    evidenceItems,
    evidenceFiles,
    eventLog,
  };
}
