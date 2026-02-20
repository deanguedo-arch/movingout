import type { Constants, EvidenceFile, EvidenceItem, PinnedChoice, Submission } from "../schema";

type ComparisonArgs = {
  submission: Submission;
  constants: Constants;
  generatedAt?: string;
  evidenceItems: EvidenceItem[];
  evidenceFiles: EvidenceFile[];
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

function snapshotCostSummary(choice: PinnedChoice): string {
  const entries = Object.entries(choice.snapshot).filter(([, value]) => typeof value === "number");
  if (entries.length === 0) {
    return "No numeric cost fields pinned.";
  }
  const topEntries = entries.slice(0, 5);
  return topEntries
    .map(([key, value]) => `${key}: ${formatMoney(Number(value))}`)
    .join(", ");
}

function choiceWarnings(choice: PinnedChoice): string {
  const warnings: string[] = [];
  if (choice.snapshot.affordability_fail === true) {
    warnings.push("Affordability warning");
  }
  if (choice.snapshot.deficit === true) {
    warnings.push("Deficit");
  }
  if (choice.snapshot.fragile_buffer === true) {
    warnings.push("Low buffer");
  }
  return warnings.length > 0 ? warnings.join(", ") : "No active warnings";
}

function evidenceSummary(args: {
  choice: PinnedChoice;
  evidenceItems: EvidenceItem[];
  evidenceFiles: EvidenceFile[];
}): string {
  const { choice, evidenceItems, evidenceFiles } = args;
  const chunks: string[] = [];
  choice.evidence_ids.forEach((evidenceId) => {
    const item = evidenceItems.find((entry) => entry.id === evidenceId);
    if (!item) {
      return;
    }
    if (item.url?.trim()) {
      chunks.push(item.url.trim());
    }
    item.file_ids.forEach((fileId) => {
      const file = evidenceFiles.find((entry) => entry.id === fileId);
      if (file) {
        chunks.push(file.filename);
      }
    });
  });
  return chunks.length > 0 ? chunks.join(" | ") : "No evidence linked";
}

export function buildComparisonSheetHtml(args: ComparisonArgs): string {
  const { submission, constants, evidenceItems, evidenceFiles } = args;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const rows = submission.pinned
    .map((choice) => {
      const categoryLabel = choice.category === "housing" ? "Housing" : "Transportation";
      return `
        <tr>
          <td>${escapeHtml(categoryLabel)}</td>
          <td>${escapeHtml(choice.label)}</td>
          <td>${escapeHtml(snapshotCostSummary(choice))}</td>
          <td>${escapeHtml(choiceWarnings(choice))}</td>
          <td>${escapeHtml(
            evidenceSummary({
              choice,
              evidenceItems,
              evidenceFiles,
            }),
          )}</td>
        </tr>
      `;
    })
    .join("");

  const tableBody =
    rows ||
    `<tr>
      <td colspan="5">No pinned options yet.</td>
    </tr>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Comparison Sheet</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; color: #111; }
      h1 { margin: 0; }
      p.meta { margin-top: 6px; color: #444; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #bbb; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #f3f5f8; }
      .disclaimer { margin-top: 16px; font-size: 0.93rem; color: #333; }
    </style>
  </head>
  <body>
    <h1>Moving Out Project - Comparison Sheet</h1>
    <p class="meta">Snapshot date: ${escapeHtml(constants.dataset_date)} | Generated: ${escapeHtml(generatedAt)}</p>
    <p class="disclaimer">Disclaimer: This is a snapshot tool for coursework; confirm details from original sources when needed.</p>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th>Chosen Option Summary</th>
          <th>Key Costs</th>
          <th>Key Flags / Warnings</th>
          <th>Evidence URLs / Filenames</th>
        </tr>
      </thead>
      <tbody>
        ${tableBody}
      </tbody>
    </table>
  </body>
</html>`;
}
