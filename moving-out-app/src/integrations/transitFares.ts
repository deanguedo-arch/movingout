import type { Constants } from "../schema";

const ETS_FARES_URL = "https://www.edmonton.ca/ets/fares-passes";
const ETS_PROXY_URL = "https://r.jina.ai/http://www.edmonton.ca/ets/fares-passes";

function todayDateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function extractMonthlyCap(text: string): number | null {
  const normalized = text.replace(/\s+/g, " ");
  const patterns = [
    /monthly fare cap[^$]{0,60}\$ ?(\d+(?:\.\d{1,2})?)/i,
    /adult arc[^$]{0,60}\$ ?(\d+(?:\.\d{1,2})?)/i,
    /arc[^$]{0,60}monthly[^$]{0,60}\$ ?(\d+(?:\.\d{1,2})?)/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return null;
}

async function fetchTransitPage(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

export async function refreshTransitSnapshot(constants: Constants): Promise<{
  constants: Constants;
  monthlyCap: number;
  sourceUrl: string;
}> {
  let text = "";
  let sourceUrl = ETS_FARES_URL;

  try {
    text = await fetchTransitPage(ETS_FARES_URL);
  } catch {
    text = await fetchTransitPage(ETS_PROXY_URL);
    sourceUrl = ETS_PROXY_URL;
  }

  const monthlyCap = extractMonthlyCap(text);
  if (!monthlyCap) {
    throw new Error("Could not find monthly fare cap value in source page.");
  }

  const next = JSON.parse(JSON.stringify(constants)) as Constants;
  next.transportation.transit_monthly_pass_default.value = monthlyCap;
  next.transportation.transit_monthly_pass_source_url = sourceUrl;
  next.transportation.transit_monthly_pass_last_updated = todayDateStamp();

  return {
    constants: next,
    monthlyCap,
    sourceUrl,
  };
}
