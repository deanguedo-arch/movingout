import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { lookupDerivedValue } from "../../app/derivedLookup";
import { getSectionFields, isReflectionRole } from "../../app/schemaSelectors";
import { useAppState } from "../../app/state";
import type { AssignmentField, FoodTableRow } from "../../schema";

function formatDerived(value: number | string, prefix?: string): string {
  if (typeof value === "number") {
    if (prefix === "$") {
      return `${prefix}${value.toFixed(2)}`;
    }
    return value.toFixed(2);
  }
  return String(value ?? "");
}

function parseInputValue(field: AssignmentField, rawValue: string): string | number | boolean | null {
  if (field.type === "number") {
    if (rawValue.trim().length === 0) {
      return null;
    }
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (field.type === "checkbox") {
    return rawValue === "true";
  }
  return rawValue;
}

function parseFoodTable(value: string | number | boolean | null | undefined, defaultRows: number): FoodTableRow[] {
  if (typeof value === "string" && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value) as FoodTableRow[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((row, index) => ({
          id: typeof row.id === "string" && row.id.length > 0 ? row.id : `row-${index + 1}`,
          item: typeof row.item === "string" ? row.item : "",
          planned_purchase: typeof row.planned_purchase === "string" ? row.planned_purchase : "",
          estimated_cost:
            typeof row.estimated_cost === "number" && Number.isFinite(row.estimated_cost)
              ? row.estimated_cost
              : 0,
          source_url: typeof row.source_url === "string" ? row.source_url : "",
        }));
      }
    } catch {
      return [];
    }
  }
  return Array.from({ length: defaultRows }, (_, index) => ({
    id: `row-${index + 1}`,
    item: "",
    planned_purchase: "",
    estimated_cost: 0,
    source_url: "",
  }));
}

function sourceBadge(status: "sourced" | "unsourced") {
  return (
    <span className={status === "sourced" ? "status-badge ok" : "status-badge warn"}>
      {status === "sourced" ? "Sourced" : "Unsourced estimate"}
    </span>
  );
}

type FieldRendererProps = {
  field: AssignmentField;
  value: string | number | boolean | null | undefined;
  onInputChange: (value: string | number | boolean | null) => void;
};

function FieldRenderer({ field, value, onInputChange }: FieldRendererProps) {
  const commonProps = {
    id: field.id,
    name: field.id,
  };

  if (field.type === "textarea") {
    return (
      <textarea
        {...commonProps}
        value={typeof value === "string" ? value : ""}
        minLength={field.validation?.min_length}
        maxLength={field.validation?.max_length}
        onChange={(event) => onInputChange(event.target.value)}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        {...commonProps}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onInputChange(event.target.value)}
      >
        <option value="">Select one</option>
        {(field.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "checkbox") {
    return (
      <input
        {...commonProps}
        type="checkbox"
        checked={Boolean(value)}
        onChange={(event) => onInputChange(event.target.checked)}
      />
    );
  }

  return (
    <input
      {...commonProps}
      type={field.type === "number" ? "number" : "text"}
      placeholder={field.ui?.placeholder}
      min={field.validation?.min}
      max={field.validation?.max}
      step={field.validation?.step}
      value={typeof value === "number" || typeof value === "string" ? value : ""}
      onChange={(event) => onInputChange(parseInputValue(field, event.target.value))}
    />
  );
}

export function SectionPage() {
  const { sectionId } = useParams();
  const {
    schema,
    constants,
    submission,
    setInputValue,
    setReflectionValue,
    recomputeNow,
    pinCategory,
    unpinCategory,
  } = useAppState();
  const section = useMemo(
    () => schema.sections.find((item) => item.id === sectionId),
    [schema.sections, sectionId],
  );

  if (!section || !sectionId) {
    return (
      <section className="page">
        <h1>Section Not Found</h1>
        <p>Choose a valid section from the sidebar.</p>
      </section>
    );
  }

  const sourceByTarget = new Map<string, string>();
  schema.fields.forEach((field) => {
    if (field.ui?.source_for_field_id) {
      sourceByTarget.set(field.ui.source_for_field_id, field.id);
    }
  });

  const fields = getSectionFields(schema, sectionId);
  const sectionIndex = schema.sections.findIndex((item) => item.id === sectionId);
  const previousSection = schema.sections[sectionIndex - 1];
  const nextSection = schema.sections[sectionIndex + 1];
  const pinConfig = schema.pinning.categories.find((category) => category.section_id === sectionId);
  const existingPin = pinConfig ? submission.pinned.find((item) => item.category === pinConfig.id) : undefined;

  return (
    <section className="page">
      <header className="page-header">
        <h1>{section.title}</h1>
        <p>{section.description}</p>
      </header>

      {sectionId === "income" ? (
        <div className="card highlight-card">
          <h2>Current Pay Anchor</h2>
          <p>
            Use CRA Payroll Deductions Online Calculator for current estimate, then paste your net pay result
            and source.
          </p>
          <a href={constants.income.cra_pdoc_url} rel="noreferrer" target="_blank">
            Open CRA PDOC
          </a>
        </div>
      ) : null}

      {sectionId === "transportation" ? (
        <div className="card highlight-card">
          <h2>Transit Snapshot</h2>
          <p>
            Cached transit monthly pass: <strong>${constants.transportation.transit_monthly_pass_default.value.toFixed(2)}</strong>
          </p>
          <p>Last updated: {constants.transportation.transit_monthly_pass_last_updated}</p>
          <a href={constants.transportation.transit_monthly_pass_source_url} rel="noreferrer" target="_blank">
            Transit source
          </a>
        </div>
      ) : null}

      <div className="section-form">
        {fields.map((field) => {
          if (field.role === "derived") {
            const derivedValue = lookupDerivedValue(submission.derived, field.compute_key);
            return (
              <div className="field-row" key={field.id}>
                <label htmlFor={field.id}>{field.label}</label>
                <output id={field.id}>{formatDerived(derivedValue, field.ui?.prefix)}</output>
              </div>
            );
          }

          const value = isReflectionRole(field) ? submission.reflections[field.id] : submission.inputs[field.id];
          const sourceFieldId = sourceByTarget.get(field.id);
          const sourceFieldValue = sourceFieldId ? submission.inputs[sourceFieldId] : null;
          const sourceStatus =
            sourceFieldId && typeof sourceFieldValue === "string"
              ? sourceFieldValue.trim().length > 0
                ? "sourced"
                : "unsourced"
              : null;

          if (field.type === "food_table") {
            const rows = parseFoodTable(value, field.ui?.default_rows ?? 8);
            return (
              <div className="field-row" key={field.id}>
                <label htmlFor={field.id}>
                  {field.label}
                  {field.required ? " *" : ""}
                </label>
                <div className="food-table-wrapper">
                  <table className="food-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Planned Purchase</th>
                        <th>Estimated Cost</th>
                        <th>Source URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={row.id}>
                          <td>
                            <input
                              type="text"
                              value={row.item}
                              onChange={(event) => {
                                const next = [...rows];
                                next[index] = {
                                  ...next[index],
                                  item: event.target.value,
                                };
                                void setInputValue(field.id, JSON.stringify(next));
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={row.planned_purchase}
                              onChange={(event) => {
                                const next = [...rows];
                                next[index] = {
                                  ...next[index],
                                  planned_purchase: event.target.value,
                                };
                                void setInputValue(field.id, JSON.stringify(next));
                              }}
                            />
                          </td>
                          <td>
                            <input
                              min={0}
                              step="0.01"
                              type="number"
                              value={row.estimated_cost}
                              onChange={(event) => {
                                const parsed = Number(event.target.value);
                                const next = [...rows];
                                next[index] = {
                                  ...next[index],
                                  estimated_cost: Number.isFinite(parsed) ? parsed : 0,
                                };
                                void setInputValue(field.id, JSON.stringify(next));
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="url"
                              value={row.source_url}
                              onChange={(event) => {
                                const next = [...rows];
                                next[index] = {
                                  ...next[index],
                                  source_url: event.target.value,
                                };
                                void setInputValue(field.id, JSON.stringify(next));
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {field.ui?.help_text ? <small>{field.ui.help_text}</small> : null}
              </div>
            );
          }

          return (
            <div className="field-row" key={field.id}>
              <label htmlFor={field.id}>
                {field.label}
                {field.required ? " *" : ""}
              </label>
              <FieldRenderer
                field={field}
                value={value}
                onInputChange={(nextValue) => {
                  void (isReflectionRole(field)
                    ? setReflectionValue(field.id, String(nextValue ?? ""))
                    : setInputValue(field.id, nextValue));
                }}
              />
              {sourceStatus ? sourceBadge(sourceStatus) : null}
              {field.ui?.help_text ? <small>{field.ui.help_text}</small> : null}
            </div>
          );
        })}
      </div>

      <div className="page-actions">
        <button type="button" onClick={() => void recomputeNow()}>
          Calculate / Check Budget
        </button>
        {pinConfig ? (
          <>
            <button type="button" onClick={() => void pinCategory(pinConfig.id)}>
              {existingPin ? "Update Pin" : "Pin this option"}
            </button>
            {existingPin ? (
              <button type="button" onClick={() => void unpinCategory(pinConfig.id)}>
                Remove Pin
              </button>
            ) : null}
          </>
        ) : null}
        {previousSection ? <Link to={`/sections/${previousSection.id}`}>Previous</Link> : null}
        {nextSection ? <Link to={`/sections/${nextSection.id}`}>Next</Link> : null}
      </div>
    </section>
  );
}
