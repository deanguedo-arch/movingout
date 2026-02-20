import type { Constants, EvidenceFile, EvidenceItem, Submission } from "../schema";
import { openBudgetDb } from "./db";

const CURRENT_SUBMISSION_KEY = "current";
const CONSTANTS_OVERRIDE_KEY = "override";

export async function getSubmission(): Promise<Submission | undefined> {
  const db = await openBudgetDb();
  return db.get("submission", CURRENT_SUBMISSION_KEY);
}

export async function saveSubmission(submission: Submission): Promise<void> {
  const db = await openBudgetDb();
  await db.put("submission", submission, CURRENT_SUBMISSION_KEY);
}

export async function clearSubmission(): Promise<void> {
  const db = await openBudgetDb();
  await db.delete("submission", CURRENT_SUBMISSION_KEY);
}

export async function getConstantsOverrides(): Promise<Constants | undefined> {
  const db = await openBudgetDb();
  return db.get("constants_overrides", CONSTANTS_OVERRIDE_KEY);
}

export async function saveConstantsOverrides(constants: Constants): Promise<void> {
  const db = await openBudgetDb();
  await db.put("constants_overrides", constants, CONSTANTS_OVERRIDE_KEY);
}

export async function clearConstantsOverrides(): Promise<void> {
  const db = await openBudgetDb();
  await db.delete("constants_overrides", CONSTANTS_OVERRIDE_KEY);
}

export async function listEvidenceItems(): Promise<EvidenceItem[]> {
  const db = await openBudgetDb();
  return db.getAll("evidence_items");
}

export async function saveEvidenceItem(item: EvidenceItem): Promise<void> {
  const db = await openBudgetDb();
  await db.put("evidence_items", item, item.id);
}

export async function getEvidenceItemById(id: string): Promise<EvidenceItem | undefined> {
  const db = await openBudgetDb();
  return db.get("evidence_items", id);
}

export async function removeEvidenceItem(id: string): Promise<void> {
  const db = await openBudgetDb();
  await db.delete("evidence_items", id);
}

export async function listEvidenceFiles(): Promise<EvidenceFile[]> {
  const db = await openBudgetDb();
  return db.getAll("evidence_files");
}

export async function listEvidenceFilesByEvidenceId(evidenceId: string): Promise<EvidenceFile[]> {
  const db = await openBudgetDb();
  return db.getAllFromIndex("evidence_files", "by_evidence_id", evidenceId);
}

export async function saveEvidenceFile(file: EvidenceFile): Promise<void> {
  const db = await openBudgetDb();
  await db.put("evidence_files", file);
}

export async function getEvidenceFileById(id: string): Promise<EvidenceFile | undefined> {
  const db = await openBudgetDb();
  return db.get("evidence_files", id);
}

export async function removeEvidenceFile(id: string): Promise<void> {
  const db = await openBudgetDb();
  await db.delete("evidence_files", id);
}

export async function clearEvidence(): Promise<void> {
  const db = await openBudgetDb();
  const tx = db.transaction(["evidence_items", "evidence_files"], "readwrite");
  await tx.objectStore("evidence_items").clear();
  await tx.objectStore("evidence_files").clear();
  await tx.done;
}
