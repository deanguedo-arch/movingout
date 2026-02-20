import type { Constants } from "../schema";

const MIN_WAGE_URL = "https://www.alberta.ca/minimum-wage";
const MIN_WAGE_PROXY_URL = "https://r.jina.ai/http://www.alberta.ca/minimum-wage";

function todayDateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function extractMinimumWage(text: string): number | null {
  const normalized = text.replace(/\s+/g, " ");
  const patterns = [
    /minimum wage[^$]{0,120}\$ ?(\d+(?:\.\d{1,2})?)/i,
    /\$ ?(\d+(?:\.\d{1,2})?)\s*(?:per hour|\/hour)/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }
    const value = Number(match[1]);
    if (Number.isFinite(value) && value >= 10 && value <= 40) {
      return value;
    }
  }
  return null;
}

async function fetchWagePage(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

export async function refreshMinimumWageSnapshot(constants: Constants): Promise<{
  constants: Constants;
  wage: number;
  sourceUrl: string;
}> {
  let text = "";
  let sourceUrl = MIN_WAGE_URL;

  try {
    text = await fetchWagePage(MIN_WAGE_URL);
  } catch {
    text = await fetchWagePage(MIN_WAGE_PROXY_URL);
    sourceUrl = MIN_WAGE_PROXY_URL;
  }

  const wage = extractMinimumWage(text);
  if (!wage) {
    throw new Error("Could not find minimum wage value in source page.");
  }

  const next = JSON.parse(JSON.stringify(constants)) as Constants;
  next.economic_snapshot.minimum_wage_ab.value = wage;
  next.economic_snapshot.minimum_wage_ab.source_url = sourceUrl;
  next.economic_snapshot.minimum_wage_ab.last_updated = todayDateStamp();

  return {
    constants: next,
    wage,
    sourceUrl,
  };
}
