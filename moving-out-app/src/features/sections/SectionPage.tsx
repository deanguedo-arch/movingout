import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { lookupDerivedValue } from "../../app/derivedLookup";
import { getSectionFields, isReflectionRole } from "../../app/schemaSelectors";
import { useAppState } from "../../app/state";
import { parseExpenseTableRows, parseFoodTableRows } from "../../rules";
import type { AssignmentField, AssignmentFieldUi, InputValue } from "../../schema";

type TableRow = {
  id: string;
  [key: string]: string | number;
};

function formatDerived(value: number | string, prefix?: string): string {
  if (typeof value === "number") {
    if (prefix === "$") {
      return `${prefix}${value.toFixed(2)}`;
    }
    return value.toFixed(2);
  }
  return String(value ?? "");
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
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

function buildDefaultTableRows(field: AssignmentField): TableRow[] {
  const defaultRows = field.ui?.default_rows ?? 5;
  const columns = field.ui?.table_columns ?? [];
  return Array.from({ length: defaultRows }, (_, index) => {
    const row: TableRow = { id: `row-${index + 1}` };
    columns.forEach((column) => {
      row[column.id] = column.type === "number" || column.type === "derived" ? 0 : "";
    });
    return row;
  });
}

function computeDerivedCellValue(row: TableRow, column: NonNullable<AssignmentFieldUi["table_columns"]>[number]): number {
  switch (column.derived_formula) {
    case "qty_x_unit_to_annual": {
      return roundCurrency(toNumber(row.quantity_per_year) * toNumber(row.average_cost));
    }
    case "annual_div_12": {
      const source = column.source_column_id ? row[column.source_column_id] : row.annual_total;
      return roundCurrency(toNumber(source) / 12);
    }
    case "sum_column": {
      if (!column.source_column_id) {
        return 0;
      }
      return roundCurrency(toNumber(row[column.source_column_id]));
    }
    default:
      return 0;
  }
}

function applyDerivedColumns(
  row: TableRow,
  columns: NonNullable<AssignmentFieldUi["table_columns"]>,
): TableRow {
  const next = { ...row };
  columns.forEach((column) => {
    if (column.type === "derived") {
      next[column.id] = computeDerivedCellValue(next, column);
    }
  });
  return next;
}

function parseTableRows(args: {
  field: AssignmentField;
  value: InputValue | undefined;
  constants: ReturnType<typeof useAppState>["constants"];
}): TableRow[] {
  const { field, constants } = args;
  const columns = field.ui?.table_columns ?? [];

  if (field.type === "food_table") {
    const rows = parseFoodTableRows({
      inputs: {
        [field.id]: args.value ?? null,
      },
      constants,
    });
    const mapped = rows.map((row, index) =>
      applyDerivedColumns(
        {
          id: typeof row.id === "string" && row.id.length > 0 ? row.id : `row-${index + 1}`,
          item: row.item,
          planned_purchase: row.planned_purchase,
          estimated_cost: row.estimated_cost,
          source_url: row.source_url,
        },
        columns,
      ),
    );
    return mapped.length > 0 ? mapped : buildDefaultTableRows(field);
  }

  if (field.type === "expense_table") {
    const rows = parseExpenseTableRows({
      inputs: {
        [field.id]: args.value ?? null,
      },
      fieldId: field.id,
    });
    const mapped = rows.map((row, index) =>
      applyDerivedColumns(
        {
          id: typeof row.id === "string" && row.id.length > 0 ? row.id : `row-${index + 1}`,
          item: row.item,
          quantity_per_year: row.quantity_per_year ?? 0,
          average_cost: row.average_cost ?? 0,
          annual_total: row.annual_total ?? 0,
          monthly_total: row.monthly_total ?? 0,
          source_url: row.source_url,
        },
        columns,
      ),
    );
    return mapped.length > 0 ? mapped : buildDefaultTableRows(field);
  }

  return [];
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

function InfoPopover(args: {
  field: AssignmentField;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const { field, isOpen, onToggle, onClose } = args;
  if (!field.ui?.info_blurb) {
    return null;
  }
  const popoverId = `${field.id}-info-popover`;

  return (
    <span
      className="field-info-wrapper"
      onBlur={(event) => {
        const nextFocus = event.relatedTarget as Node | null;
        if (!event.currentTarget.contains(nextFocus)) {
          onClose();
        }
      }}
    >
      <button
        aria-controls={popoverId}
        aria-expanded={isOpen}
        aria-label={`More info about ${field.label}`}
        className="info-trigger"
        type="button"
        onClick={onToggle}
      >
        (i)
      </button>
      {isOpen ? (
        <div className="info-popover" id={popoverId} role="dialog">
          <p className="info-popover-title">{field.ui.info_title ?? field.label}</p>
          <p>{field.ui.info_blurb}</p>
          {field.ui.info_source_url ? (
            <a href={field.ui.info_source_url} rel="noreferrer" target="_blank">
              {field.ui.info_source_label ?? "Source"}
            </a>
          ) : null}
        </div>
      ) : null}
    </span>
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
  const [openInfoFieldId, setOpenInfoFieldId] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenInfoFieldId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

      {section.guide ? (
        <section className="card section-guide">
          <h2>Section Guide</h2>
          <ul>
            <li>
              <strong>What this part asks you to do:</strong> {section.guide.what_this_part}
            </li>
            <li>
              <strong>What changed for today:</strong> {section.guide.updated_for_today}
            </li>
            <li>
              <strong>How to research this now:</strong> {section.guide.how_to_research}
            </li>
          </ul>
        </section>
      ) : null}

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
                <label htmlFor={field.id}>
                  {field.label}
                  <InfoPopover
                    field={field}
                    isOpen={openInfoFieldId === field.id}
                    onToggle={() => setOpenInfoFieldId(openInfoFieldId === field.id ? null : field.id)}
                    onClose={() => setOpenInfoFieldId(null)}
                  />
                </label>
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

          if (field.type === "food_table" || field.type === "expense_table") {
            const rows = parseTableRows({
              field,
              value,
              constants,
            });
            const columns = field.ui?.table_columns ?? [];
            const tableSourceStatus = rows.some((row) => String(row.source_url ?? "").trim().length > 0)
              ? "sourced"
              : "unsourced";

            return (
              <div className="field-row" key={field.id}>
                <label htmlFor={field.id}>
                  {field.label}
                  {field.required ? " *" : ""}
                  <InfoPopover
                    field={field}
                    isOpen={openInfoFieldId === field.id}
                    onToggle={() => setOpenInfoFieldId(openInfoFieldId === field.id ? null : field.id)}
                    onClose={() => setOpenInfoFieldId(null)}
                  />
                </label>
                <div className="food-table-wrapper">
                  <table className="food-table">
                    <thead>
                      <tr>
                        {columns.map((column) => (
                          <th key={`${field.id}-${column.id}`}>{column.label}</th>
                        ))}
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, rowIndex) => (
                        <tr key={row.id}>
                          {columns.map((column) => {
                            const cellValue = row[column.id] ?? (column.type === "number" || column.type === "derived" ? 0 : "");
                            if (column.type === "derived") {
                              return (
                                <td key={`${row.id}-${column.id}`}>
                                  <output>{formatDerived(cellValue, "$")}</output>
                                </td>
                              );
                            }

                            if (column.type === "select") {
                              return (
                                <td key={`${row.id}-${column.id}`}>
                                  <select
                                    value={String(cellValue)}
                                    onChange={(event) => {
                                      const nextRows = [...rows];
                                      const nextRow = {
                                        ...nextRows[rowIndex],
                                        [column.id]: event.target.value,
                                      };
                                      nextRows[rowIndex] = applyDerivedColumns(nextRow, columns);
                                      void setInputValue(field.id, JSON.stringify(nextRows));
                                    }}
                                  >
                                    <option value="">Select one</option>
                                    {(column.options ?? []).map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              );
                            }

                            return (
                              <td key={`${row.id}-${column.id}`}>
                                <input
                                  min={column.type === "number" ? 0 : undefined}
                                  step={column.type === "number" ? "0.01" : undefined}
                                  type={column.type === "number" ? "number" : column.type === "url" ? "url" : "text"}
                                  value={String(cellValue)}
                                  onChange={(event) => {
                                    const nextRows = [...rows];
                                    const parsedValue =
                                      column.type === "number"
                                        ? roundCurrency(toNumber(event.target.value))
                                        : event.target.value;
                                    const nextRow = {
                                      ...nextRows[rowIndex],
                                      [column.id]: parsedValue,
                                    };
                                    nextRows[rowIndex] = applyDerivedColumns(nextRow, columns);
                                    void setInputValue(field.id, JSON.stringify(nextRows));
                                  }}
                                />
                              </td>
                            );
                          })}
                          <td>
                            <button
                              className="row-button"
                              type="button"
                              onClick={() => {
                                if (rows.length <= 1) {
                                  return;
                                }
                                const nextRows = rows.filter((_, index) => index !== rowIndex);
                                void setInputValue(field.id, JSON.stringify(nextRows));
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="table-actions">
                  <button
                    className="row-button"
                    type="button"
                    onClick={() => {
                      const defaultRow = buildDefaultTableRows({
                        ...field,
                        ui: {
                          ...field.ui,
                          default_rows: 1,
                        },
                      })[0];
                      const nextRows = [
                        ...rows,
                        applyDerivedColumns(
                          {
                            ...defaultRow,
                            id: `row-${rows.length + 1}`,
                          },
                          columns,
                        ),
                      ];
                      void setInputValue(field.id, JSON.stringify(nextRows));
                    }}
                  >
                    Add Row
                  </button>
                  {sourceBadge(tableSourceStatus)}
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
                <InfoPopover
                  field={field}
                  isOpen={openInfoFieldId === field.id}
                  onToggle={() => setOpenInfoFieldId(openInfoFieldId === field.id ? null : field.id)}
                  onClose={() => setOpenInfoFieldId(null)}
                />
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
