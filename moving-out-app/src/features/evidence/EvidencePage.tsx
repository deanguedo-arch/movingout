import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../../app/state";
import type { EvidenceType } from "../../schema";

const ACCEPT_ATTR = ".jpg,.jpeg,.png,.webp,.pdf";

export function EvidencePage() {
  const { schema, evidence, evidenceFiles, saveEvidence, removeEvidence, submission } = useAppState();
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>({});
  const [fileDrafts, setFileDrafts] = useState<Record<string, File[]>>({});

  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    schema.evidence_requirements.forEach((requirement) => {
      const item = evidence.find((entry) => entry.type === requirement.id);
      nextDrafts[requirement.id] = item?.url ?? "";
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrlDrafts(nextDrafts);
  }, [evidence, schema.evidence_requirements]);

  const filesByEvidenceId = useMemo(() => {
    const map = new Map<string, typeof evidenceFiles>();
    evidenceFiles.forEach((file) => {
      const existing = map.get(file.evidence_id) ?? [];
      map.set(file.evidence_id, [...existing, file]);
    });
    return map;
  }, [evidenceFiles]);

  return (
    <section className="page">
      <header className="page-header">
        <h1>Evidence Center</h1>
        <p>Add required rental and vehicle evidence. URL is required; file upload is optional.</p>
      </header>

      <div className="card">
        <h2>Evidence Status</h2>
        <ul>
          {schema.evidence_requirements.map((requirement) => {
            const missing = submission.flags.missing_required_evidence.includes(requirement.id);
            return (
              <li key={requirement.id}>
                {requirement.label}: {missing ? "Missing" : "Complete"}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="card-grid">
        {schema.evidence_requirements.map((requirement) => {
          const item = evidence.find((entry) => entry.type === requirement.id);
          const files = item ? filesByEvidenceId.get(item.id) ?? [] : [];
          const draftFiles = fileDrafts[requirement.id] ?? [];

          return (
            <article className="card" key={requirement.id}>
              <h2>{requirement.label}</h2>
              <p>{requirement.description}</p>

              <label htmlFor={`${requirement.id}-url`}>Listing URL</label>
              <input
                id={`${requirement.id}-url`}
                placeholder="https://..."
                type="url"
                value={urlDrafts[requirement.id] ?? ""}
                onChange={(event) =>
                  setUrlDrafts((prev) => ({
                    ...prev,
                    [requirement.id]: event.target.value,
                  }))
                }
              />

              <label htmlFor={`${requirement.id}-file`}>Optional file upload</label>
              <input
                accept={ACCEPT_ATTR}
                id={`${requirement.id}-file`}
                multiple
                type="file"
                onChange={(event) => {
                  const selected = Array.from(event.target.files ?? []);
                  setFileDrafts((prev) => ({
                    ...prev,
                    [requirement.id]: selected,
                  }));
                }}
              />

              {files.length > 0 ? (
                <>
                  <h3>Saved Files</h3>
                  <ul>
                    {files.map((file) => (
                      <li key={file.id}>
                        {file.filename} ({Math.round(file.size / 1024)} KB)
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {draftFiles.length > 0 ? (
                <>
                  <h3>Pending Upload</h3>
                  <ul>
                    {draftFiles.map((file) => (
                      <li key={file.name}>{file.name}</li>
                    ))}
                  </ul>
                </>
              ) : null}

              <div className="page-actions">
                <button
                  type="button"
                  onClick={() =>
                    void saveEvidence({
                      type: requirement.id as EvidenceType,
                      url: urlDrafts[requirement.id] ?? "",
                      files: draftFiles,
                    }).then(() =>
                      setFileDrafts((prev) => ({
                        ...prev,
                        [requirement.id]: [],
                      })),
                    )
                  }
                >
                  Save Evidence
                </button>
                <button
                  type="button"
                  onClick={() => void removeEvidence(requirement.id as EvidenceType)}
                >
                  Remove Evidence
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
