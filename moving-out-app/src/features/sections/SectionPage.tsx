import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { lookupDerivedValue } from "../../app/derivedLookup";
import { getSectionFields, isReflectionRole } from "../../app/schemaSelectors";
import { useAppState } from "../../app/state";
import type { AssignmentField } from "../../schema";

function formatDerived(value: number | string, prefix?: string): string {
  if (typeof value === "number") {
    const formatted = value.toFixed(2);
    return prefix ? `${prefix}${formatted}` : formatted;
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

  const fields = getSectionFields(schema, sectionId);
  const sectionIndex = schema.sections.findIndex((item) => item.id === sectionId);
  const previousSection = schema.sections[sectionIndex - 1];
  const nextSection = schema.sections[sectionIndex + 1];
  const pinConfig = schema.pinning.categories.find((category) => category.section_id === sectionId);
  const existingPin = pinConfig
    ? submission.pinned.find((item) => item.category === pinConfig.id)
    : undefined;

  return (
    <section className="page">
      <header className="page-header">
        <h1>{section.title}</h1>
        <p>{section.description}</p>
      </header>

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

          const value = isReflectionRole(field)
            ? submission.reflections[field.id]
            : submission.inputs[field.id];

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
