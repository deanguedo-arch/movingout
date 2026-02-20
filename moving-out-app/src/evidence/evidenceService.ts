import { appendEvent } from "../logs/eventLog";
import type { EvidenceFile, EvidenceItem, EvidenceType, Submission } from "../schema";
import {
  getEvidenceItemById,
  listEvidenceFilesByEvidenceId,
  listEvidenceItems,
  removeEvidenceFile,
  removeEvidenceItem,
  saveEvidenceFile,
  saveEvidenceItem,
  saveSubmission,
} from "../storage/repositories";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

async function hashBlobSha256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function filterAcceptedFiles(files: File[]): File[] {
  return files.filter((file) => ALLOWED_MIME_TYPES.has(file.type));
}

function makeEvidenceFile(args: { evidenceId: string; file: File }): Promise<EvidenceFile> {
  const { evidenceId, file } = args;
  return hashBlobSha256(file).then((sha256) => ({
    id: crypto.randomUUID(),
    evidence_id: evidenceId,
    filename: file.name,
    mime: file.type,
    size: file.size,
    sha256,
    created_at: new Date().toISOString(),
    blob: file,
  }));
}

export async function upsertEvidenceForType(args: {
  type: EvidenceType;
  url?: string;
  files?: File[];
  submission: Submission;
}): Promise<{ evidenceItems: EvidenceItem[]; submission: Submission }> {
  const { type, url, files = [], submission } = args;
  const existingItems = await listEvidenceItems();
  const existing = existingItems.find((item) => item.type === type);

  const evidenceId = existing?.id ?? crypto.randomUUID();
  const acceptedFiles = filterAcceptedFiles(files);
  const createdFiles = await Promise.all(
    acceptedFiles.map((file) =>
      makeEvidenceFile({
        evidenceId,
        file,
      }),
    ),
  );
  for (const file of createdFiles) {
    await saveEvidenceFile(file);
  }

  const existingFileIds = existing?.file_ids ?? [];
  const fileIds = [...existingFileIds, ...createdFiles.map((file) => file.id)];
  const nextItem: EvidenceItem = {
    id: evidenceId,
    type,
    url: url?.trim() || existing?.url || "",
    file_ids: fileIds,
    created_at: existing?.created_at ?? new Date().toISOString(),
  };

  await saveEvidenceItem(nextItem);
  await appendEvent("EVIDENCE_ADD", {
    evidence_id: nextItem.id,
    type,
    file_count_added: createdFiles.length,
    has_url: (nextItem.url ?? "").trim().length > 0,
  });

  const nextEvidenceItems = await listEvidenceItems();
  const nextEvidenceRefs = {
    ...submission.evidence_refs,
    [type]: [nextItem.id],
  };
  const nextSubmission: Submission = {
    ...submission,
    evidence_refs: nextEvidenceRefs,
    updated_at: new Date().toISOString(),
  };
  await saveSubmission(nextSubmission);

  return {
    evidenceItems: nextEvidenceItems,
    submission: nextSubmission,
  };
}

export async function removeEvidenceByType(args: {
  type: EvidenceType;
  submission: Submission;
}): Promise<{ evidenceItems: EvidenceItem[]; submission: Submission }> {
  const { type, submission } = args;
  const evidenceId = submission.evidence_refs[type]?.[0];
  if (!evidenceId) {
    return {
      evidenceItems: await listEvidenceItems(),
      submission,
    };
  }
  const item = await getEvidenceItemById(evidenceId);
  if (item) {
    const files = await listEvidenceFilesByEvidenceId(item.id);
    await Promise.all(files.map((file) => removeEvidenceFile(file.id)));
    await removeEvidenceItem(item.id);
    await appendEvent("EVIDENCE_REMOVE", {
      evidence_id: item.id,
      type: item.type,
      removed_file_count: files.length,
    });
  }

  const nextEvidenceRefs = { ...submission.evidence_refs };
  delete nextEvidenceRefs[type];
  const nextSubmission: Submission = {
    ...submission,
    evidence_refs: nextEvidenceRefs,
    updated_at: new Date().toISOString(),
  };
  await saveSubmission(nextSubmission);

  return {
    evidenceItems: await listEvidenceItems(),
    submission: nextSubmission,
  };
}
