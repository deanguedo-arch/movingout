import { useMemo } from "react";
import { useAppState } from "../../app/state";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
  }).format(value);
}

function badge(label: string, tone: "warn" | "ok") {
  return <span className={tone === "ok" ? "status-badge ok" : "status-badge warn"}>{label}</span>;
}

export function ReadinessPage() {
  const { schema, submission } = useAppState();
  const fieldLabelMap = useMemo(
    () => new Map(schema.fields.map((field) => [field.id, field.label])),
    [schema.fields],
  );

  return (
    <section className="page">
      <header className="page-header">
        <h1>Readiness Check</h1>
        <p>Transparent warnings only. No gating and no extra workflow.</p>
      </header>

      <div className="card-grid">
        <article className="card">
          <h2>Missing Required Fields</h2>
          {submission.flags.missing_required_fields.length === 0 ? (
            <p>{badge("Complete", "ok")}</p>
          ) : (
            <ul>
              {submission.flags.missing_required_fields.map((fieldId) => (
                <li key={fieldId}>{fieldLabelMap.get(fieldId) ?? fieldId}</li>
              ))}
            </ul>
          )}
        </article>

        <article className="card">
          <h2>Missing Required Evidence</h2>
          {submission.flags.missing_required_evidence.length === 0 ? (
            <p>{badge("Complete", "ok")}</p>
          ) : (
            <ul>
              {submission.flags.missing_required_evidence.map((evidenceId) => (
                <li key={evidenceId}>{evidenceId}</li>
              ))}
            </ul>
          )}
        </article>

        <article className="card">
          <h2>Budget Signals</h2>
          <ul>
            <li>Affordability: {submission.flags.affordability_fail ? badge("Housing heavy", "warn") : badge("OK", "ok")}</li>
            <li>Deficit: {submission.flags.deficit ? badge("Deficit", "warn") : badge("Surplus", "ok")}</li>
            <li>Low buffer: {submission.flags.fragile_buffer ? badge("Low buffer", "warn") : badge("OK", "ok")}</li>
            <li>
              Vehicle minimum:{" "}
              {submission.flags.low_vehicle_price ? badge("Below $3,000", "warn") : badge("OK", "ok")}
            </li>
            <li>Surplus/Deficit amount: {formatCurrency(submission.flags.surplus_or_deficit_amount)}</li>
          </ul>
        </article>
      </div>

      <section className="card">
        <h2>Source Confidence</h2>
        {submission.flags.unsourced_categories.length === 0 ? (
          <p>{badge("All major categories sourced", "ok")}</p>
        ) : (
          <ul>
            {submission.flags.unsourced_categories.map((category) => (
              <li key={category}>{badge(`${category}: unsourced estimate`, "warn")}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Fix Next</h2>
        {submission.flags.fix_next.length === 0 ? (
          <p>Everything looks complete right now.</p>
        ) : (
          <ol>
            {submission.flags.fix_next.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
