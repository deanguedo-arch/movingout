import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Constants, EvidenceFile, EvidenceItem, EventLogEntry, Submission } from "../schema";

const DB_NAME = "moving-out-budget-db";
const DB_VERSION = 1;

type MetaRecord = number | string | Record<string, unknown> | null;

export interface BudgetDbSchema extends DBSchema {
  submission: {
    key: string;
    value: Submission;
  };
  constants_overrides: {
    key: string;
    value: Constants;
  };
  evidence_items: {
    key: string;
    value: EvidenceItem;
  };
  evidence_files: {
    key: string;
    value: EvidenceFile;
    indexes: {
      by_evidence_id: string;
    };
  };
  event_log: {
    key: number;
    value: EventLogEntry;
    indexes: {
      by_timestamp: string;
    };
  };
  meta: {
    key: string;
    value: MetaRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<BudgetDbSchema>> | undefined;

export function openBudgetDb(): Promise<IDBPDatabase<BudgetDbSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<BudgetDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("submission")) {
          db.createObjectStore("submission");
        }
        if (!db.objectStoreNames.contains("constants_overrides")) {
          db.createObjectStore("constants_overrides");
        }
        if (!db.objectStoreNames.contains("evidence_items")) {
          db.createObjectStore("evidence_items");
        }
        if (!db.objectStoreNames.contains("evidence_files")) {
          const evidenceFiles = db.createObjectStore("evidence_files", { keyPath: "id" });
          evidenceFiles.createIndex("by_evidence_id", "evidence_id", { unique: false });
        }
        if (!db.objectStoreNames.contains("event_log")) {
          const eventLog = db.createObjectStore("event_log", { keyPath: "seq" });
          eventLog.createIndex("by_timestamp", "timestamp", { unique: false });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta");
        }
      },
    });
  }
  return dbPromise!;
}

export async function closeBudgetDb(): Promise<void> {
  if (!dbPromise) {
    return;
  }
  const db = await dbPromise;
  db.close();
  dbPromise = undefined;
}

export async function resetBudgetDb(): Promise<void> {
  await closeBudgetDb();
  await deleteDB(DB_NAME);
}
