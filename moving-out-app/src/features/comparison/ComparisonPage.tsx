import { useMemo, useState } from "react";
import { buildComparisonSheetHtml } from "../../artifacts/comparisonSheet";
import { useAppState } from "../../app/state";

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

  return (
    <section className="page">
      <header className="page-header">
        <h1>Comparison Sheet Generator</h1>
        <p>This sheet uses pinned choices only.</p>
      </header>

      <div className="card">
        <h2>Pinned Items</h2>
        {submission.pinned.length === 0 ? (
          <p>No pinned items yet. Pin at least one housing and one transportation option.</p>
        ) : (
          <ul>
            {submission.pinned.map((item) => (
              <li key={item.id}>
                {item.category}: {item.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="page-actions">
        <button type="button" onClick={() => setGeneratedAt(new Date().toISOString())}>
          Regenerate Sheet
        </button>
        <button type="button" onClick={() => window.print()}>
          Print Current View
        </button>
      </div>

      <div className="card">
        <h2>Preview</h2>
        <iframe
          srcDoc={comparisonHtml}
          style={{ width: "100%", minHeight: "520px", border: "1px solid #d6dbe3" }}
          title="Comparison Sheet Preview"
        />
      </div>
    </section>
  );
}
