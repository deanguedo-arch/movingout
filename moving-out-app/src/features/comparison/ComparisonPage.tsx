import { useMemo, useState } from "react";
import { buildComparisonSheetHtml } from "../../artifacts/comparisonSheet";
import { useAppState } from "../../app/state";
import type { PinnedChoice } from "../../schema";

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
  }).format(value);
}

function pinnedCost(choice: PinnedChoice): number {
  if (choice.category === "housing") {
    return asNumber(choice.snapshot.housing_monthly_total);
  }
  return asNumber(choice.snapshot.transport_monthly_total);
}

function warningTags(choice: PinnedChoice): string[] {
  const tags: string[] = [];
  if (choice.snapshot.affordability_fail === true) {
    tags.push("Housing heavy");
  }
  if (choice.snapshot.deficit === true) {
    tags.push("Deficit");
  }
  if (choice.snapshot.fragile_buffer === true) {
    tags.push("Low buffer");
  }
  return tags;
}

export function ComparisonPage() {
  const { submission, constants, evidence, evidenceFiles } = useAppState();
  const [generatedAt, setGeneratedAt] = useState(new Date().toISOString());

  const comparisonHtml = useMemo(
    () =>
      buildComparisonSheetHtml({
        submission,
        constants,
        evidenceItems: evidence,
        evidenceFiles,
        generatedAt,
      }),
    [constants, evidence, evidenceFiles, generatedAt, submission],
  );

  const housingPins = submission.pinned
    .filter((item) => item.category === "housing")
    .sort((a, b) => pinnedCost(a) - pinnedCost(b));
  const transportPins = submission.pinned
    .filter((item) => item.category === "transportation")
    .sort((a, b) => pinnedCost(a) - pinnedCost(b));

  const bestHousingId = housingPins[0]?.id ?? "";
  const bestTransportId = transportPins[0]?.id ?? "";

  return (
    <section className="page">
      <header className="page-header">
        <h1>Compare Pinned Choices</h1>
        <p>Pinned options are shown side-by-side to support your decision.</p>
      </header>

      <div className="card-grid compare-grid">
        <article className="card">
          <h2>Housing Options</h2>
          {housingPins.length === 0 ? (
            <p>No housing options pinned yet.</p>
          ) : (
            <div className="compare-list">
              {housingPins.map((choice) => (
                <div className={choice.id === bestHousingId ? "compare-item winner" : "compare-item"} key={choice.id}>
                  <h3>{choice.label}</h3>
                  <p>Monthly cost: {formatCurrency(pinnedCost(choice))}</p>
                  <div className="badge-row">
                    {choice.id === bestHousingId ? <span className="status-badge ok">Lowest monthly cost</span> : null}
                    {warningTags(choice).map((tag) => (
                      <span className="status-badge warn" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="card">
          <h2>Transportation Options</h2>
          {transportPins.length === 0 ? (
            <p>No transportation options pinned yet.</p>
          ) : (
            <div className="compare-list">
              {transportPins.map((choice) => (
                <div className={choice.id === bestTransportId ? "compare-item winner" : "compare-item"} key={choice.id}>
                  <h3>{choice.label}</h3>
                  <p>Monthly cost: {formatCurrency(pinnedCost(choice))}</p>
                  <div className="badge-row">
                    {choice.id === bestTransportId ? <span className="status-badge ok">Lowest monthly cost</span> : null}
                    {warningTags(choice).map((tag) => (
                      <span className="status-badge warn" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <div className="card">
        <h2>Comparison Sheet Artifact</h2>
        <p>Generate printable HTML based only on current pinned choices.</p>
        <div className="page-actions">
          <button type="button" onClick={() => setGeneratedAt(new Date().toISOString())}>
            Regenerate Sheet
          </button>
          <button type="button" onClick={() => window.print()}>
            Print Current View
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Artifact Preview</h2>
        <iframe
          srcDoc={comparisonHtml}
          style={{ width: "100%", minHeight: "520px", border: "1px solid #d6dbe3" }}
          title="Comparison Sheet Preview"
        />
      </div>
    </section>
  );
}
