import { useMemo } from "react";
import { useAppState } from "../../app/state";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
  }).format(value);
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
        <p>Use this list to fix the most important issues first.</p>
      </header>

      <div className="card-grid">
        <article className="card">
          <h2>Missing Required Fields</h2>
          {submission.flags.missing_required_fields.length === 0 ? (
            <p>None.</p>
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
            <p>None.</p>
          ) : (
            <ul>
              {submission.flags.missing_required_evidence.map((evidenceId) => (
                <li key={evidenceId}>{evidenceId}</li>
              ))}
            </ul>
          )}
        </article>

        <article className="card">
          <h2>Budget Health</h2>
          <ul>
            <li>Affordability warning: {submission.flags.affordability_fail ? "Yes" : "No"}</li>
            <li>Deficit: {submission.flags.deficit ? "Yes" : "No"}</li>
            <li>Fragile buffer: {submission.flags.fragile_buffer ? "Yes" : "No"}</li>
            <li>Surplus/Deficit amount: {formatCurrency(submission.flags.surplus_or_deficit_amount)}</li>
          </ul>
        </article>
      </div>

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
