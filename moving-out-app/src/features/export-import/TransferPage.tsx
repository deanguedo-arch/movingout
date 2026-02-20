import { useState } from "react";
import { useAppState } from "../../app/state";

function downloadBlob(args: { blob: Blob; filename: string }) {
  const url = URL.createObjectURL(args.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = args.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function TransferPage() {
  const { exportSubmissionPackage, importSubmissionPackage } = useAppState();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    setStatus("Building ZIP package...");
    try {
      const blob = await exportSubmissionPackage();
      downloadBlob({
        blob,
        filename: `moving-out-submission-${new Date().toISOString().replaceAll(":", "-")}.zip`,
      });
      setStatus("Export complete.");
    } catch (error) {
      setStatus(`Export failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!selectedFile) {
      setStatus("Choose a ZIP file first.");
      return;
    }
    setBusy(true);
    setStatus("Importing ZIP package...");
    try {
      await importSubmissionPackage(selectedFile);
      setStatus("Import complete. Data restored.");
    } catch (error) {
      setStatus(`Import failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>Export / Import</h1>
        <p>Export one ZIP package or import a ZIP to continue/review a submission.</p>
      </header>

      <div className="card">
        <h2>Export ZIP</h2>
        <p>Includes submission, schema/constants snapshots, evidence files, logs, and artifacts.</p>
        <button disabled={busy} type="button" onClick={() => void handleExport()}>
          Export ZIP
        </button>
      </div>

      <div className="card">
        <h2>Import ZIP</h2>
        <input
          accept=".zip,application/zip"
          type="file"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
        />
        <div className="page-actions">
          <button disabled={busy} type="button" onClick={() => void handleImport()}>
            Import ZIP
          </button>
        </div>
      </div>

      {status ? <p>{status}</p> : null}
    </section>
  );
}
