import type { EventLogEntry, EventType } from "../schema";
import { openBudgetDb } from "../storage/db";

const EVENT_SEQ_KEY = "event_seq";

export async function listEventLog(): Promise<EventLogEntry[]> {
  const db = await openBudgetDb();
  const entries = await db.getAll("event_log");
  return entries.sort((a: EventLogEntry, b: EventLogEntry) => a.seq - b.seq);
}

export async function appendEvent(
  eventType: EventType,
  payload: Record<string, unknown>,
  timestamp?: string,
): Promise<EventLogEntry> {
  const db = await openBudgetDb();
  const tx = db.transaction(["event_log", "meta"], "readwrite");
  const eventStore = tx.objectStore("event_log");
  const metaStore = tx.objectStore("meta");
  const currentSeqRaw = await metaStore.get(EVENT_SEQ_KEY);
  const currentSeq = typeof currentSeqRaw === "number" ? currentSeqRaw : 0;
  const nextSeq = currentSeq + 1;

  const entry: EventLogEntry = {
    seq: nextSeq,
    timestamp: timestamp ?? new Date().toISOString(),
    event_type: eventType,
    payload,
  };

  await eventStore.put(entry);
  await metaStore.put(nextSeq, EVENT_SEQ_KEY);
  await tx.done;

  return entry;
}

export async function clearEventLog(): Promise<void> {
  const db = await openBudgetDb();
  const tx = db.transaction(["event_log", "meta"], "readwrite");
  await tx.objectStore("event_log").clear();
  await tx.objectStore("meta").put(0, EVENT_SEQ_KEY);
  await tx.done;
}

export async function replaceEventLog(entries: EventLogEntry[]): Promise<void> {
  const db = await openBudgetDb();
  const sorted = [...entries].sort((a, b) => a.seq - b.seq);
  const tx = db.transaction(["event_log", "meta"], "readwrite");
  const eventStore = tx.objectStore("event_log");
  const metaStore = tx.objectStore("meta");
  await eventStore.clear();
  for (const entry of sorted) {
    await eventStore.put(entry);
  }
  const highestSeq = sorted.at(-1)?.seq ?? 0;
  await metaStore.put(highestSeq, EVENT_SEQ_KEY);
  await tx.done;
}
