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
