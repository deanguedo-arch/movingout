import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../../app/state";
import type { Constants } from "../../schema";

function deepCloneConstants(constants: Constants): Constants {
  return JSON.parse(JSON.stringify(constants)) as Constants;
}

export function TeacherPage() {
  const { constants, setConstantsOverride, resetConstantsToDefault } = useAppState();
  const [inputPasscode, setInputPasscode] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState<Constants>(() => deepCloneConstants(constants));
  const [loanPointsJson, setLoanPointsJson] = useState(
    JSON.stringify(constants.transportation.loan_payment_table.points, null, 2),
  );

  useEffect(() => {
    setDraft(deepCloneConstants(constants));
    setLoanPointsJson(JSON.stringify(constants.transportation.loan_payment_table.points, null, 2));
  }, [constants]);

  function unlock() {
    if (inputPasscode === constants.teacher_mode.default_passcode) {
      setIsUnlocked(true);
      setError("");
      return;
    }
    setError("Incorrect passcode.");
  }

  function setNumeric(path: string, value: number) {
    setDraft((prev) => {
      const next = deepCloneConstants(prev);
      switch (path) {
        case "deductions.income_tax_rate":
          next.deductions.income_tax_rate.value = value;
          break;
        case "deductions.cpp_rate":
          next.deductions.cpp_rate.value = value;
          break;
        case "deductions.ei_rate":
          next.deductions.ei_rate.value = value;
          break;
        case "deductions.union_dues_rate":
          next.deductions.union_dues_rate.value = value;
          break;
        case "thresholds.affordability":
          next.thresholds.affordability_housing_fraction_of_net.value = value;
          break;
        case "thresholds.buffer":
          next.thresholds.buffer_warning_threshold.value = value;
          break;
        case "transport.weeks_per_month":
          next.transportation.weeks_per_month.value = value;
          break;
        case "transport.default_down_payment":
          next.transportation.default_down_payment_fraction.value = value;
          break;
        case "transport.default_term_months":
          next.transportation.default_term_months.value = value;
          break;
        case "transport.default_apr_percent":
          next.transportation.default_apr_percent.value = value;
          break;
        case "transport.car_cost_per_km":
          next.transportation.operating_cost_per_km.car.value = value;
          break;
        case "transport.truck_cost_per_km":
          next.transportation.operating_cost_per_km.truck.value = value;
          break;
        case "transport.baseline_term":
          next.transportation.loan_payment_table.baseline_term_months = value;
          break;
        case "transport.baseline_apr":
          next.transportation.loan_payment_table.baseline_apr_percent = value;
          break;
        default:
          break;
      }
      return next;
    });
  }

  const changedKeys = useMemo(() => {
    const original = JSON.stringify(constants);
    const next = JSON.stringify(draft);
    if (original === next) {
      return [];
    }
    return ["teacher_constants_update"];
  }, [constants, draft]);

  async function saveDraft() {
    try {
      const parsedPoints = JSON.parse(loanPointsJson) as Array<{
        principal: number;
        monthly_payment: number;
      }>;
      if (!Array.isArray(parsedPoints) || parsedPoints.length === 0) {
        throw new Error("Loan table points must be a non-empty array.");
      }

      const next = deepCloneConstants(draft);
      next.transportation.loan_payment_table.points = parsedPoints.map((point) => ({
        principal: Number(point.principal),
        monthly_payment: Number(point.monthly_payment),
      }));

      await setConstantsOverride(next, changedKeys.length > 0 ? changedKeys : ["teacher_constants_update"]);
      setStatus("Constants saved.");
    } catch (saveError) {
      setStatus(`Save failed: ${(saveError as Error).message}`);
    }
  }

  async function resetDefaults() {
    await resetConstantsToDefault();
    setStatus("Constants reset to default values.");
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>Teacher Mode</h1>
        <p>Edit constants used by calculations. Students see these values read-only.</p>
      </header>

      {!isUnlocked ? (
        <div className="card">
          <label htmlFor="teacher-passcode">Teacher passcode</label>
          <input
            id="teacher-passcode"
            type="password"
            value={inputPasscode}
            onChange={(event) => setInputPasscode(event.target.value)}
          />
          <div className="page-actions">
            <button type="button" onClick={unlock}>
              Unlock
            </button>
          </div>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      ) : (
        <>
          <div className="card-grid">
            <article className="card">
              <h2>Deductions</h2>
              <label>Income Tax Rate</label>
              <input
                type="number"
                step="0.0001"
                value={draft.deductions.income_tax_rate.value}
                onChange={(event) => setNumeric("deductions.income_tax_rate", Number(event.target.value))}
              />
              <label>CPP Rate</label>
              <input
                type="number"
                step="0.0001"
                value={draft.deductions.cpp_rate.value}
                onChange={(event) => setNumeric("deductions.cpp_rate", Number(event.target.value))}
              />
              <label>EI Rate</label>
              <input
                type="number"
                step="0.0001"
                value={draft.deductions.ei_rate.value}
                onChange={(event) => setNumeric("deductions.ei_rate", Number(event.target.value))}
              />
              <label>Union Dues Rate</label>
              <input
                type="number"
                step="0.0001"
                value={draft.deductions.union_dues_rate.value}
                onChange={(event) => setNumeric("deductions.union_dues_rate", Number(event.target.value))}
              />
            </article>

            <article className="card">
              <h2>Thresholds</h2>
              <label>Housing Affordability Fraction</label>
              <input
                type="number"
                step="0.01"
                value={draft.thresholds.affordability_housing_fraction_of_net.value}
                onChange={(event) => setNumeric("thresholds.affordability", Number(event.target.value))}
              />
              <label>Buffer Warning Threshold</label>
              <input
                type="number"
                step="1"
                value={draft.thresholds.buffer_warning_threshold.value}
                onChange={(event) => setNumeric("thresholds.buffer", Number(event.target.value))}
              />
            </article>

            <article className="card">
              <h2>Transportation Defaults</h2>
              <label>Weeks Per Month</label>
              <input
                type="number"
                step="0.01"
                value={draft.transportation.weeks_per_month.value}
                onChange={(event) => setNumeric("transport.weeks_per_month", Number(event.target.value))}
              />
              <label>Default Down Payment Fraction</label>
              <input
                type="number"
                step="0.01"
                value={draft.transportation.default_down_payment_fraction.value}
                onChange={(event) => setNumeric("transport.default_down_payment", Number(event.target.value))}
              />
              <label>Default Loan Term (Months)</label>
              <input
                type="number"
                step="1"
                value={draft.transportation.default_term_months.value}
                onChange={(event) => setNumeric("transport.default_term_months", Number(event.target.value))}
              />
              <label>Default APR (%)</label>
              <input
                type="number"
                step="0.01"
                value={draft.transportation.default_apr_percent.value}
                onChange={(event) => setNumeric("transport.default_apr_percent", Number(event.target.value))}
              />
              <label>Car Cost/km</label>
              <input
                type="number"
                step="0.01"
                value={draft.transportation.operating_cost_per_km.car.value}
                onChange={(event) => setNumeric("transport.car_cost_per_km", Number(event.target.value))}
              />
              <label>Truck Cost/km</label>
              <input
                type="number"
                step="0.01"
                value={draft.transportation.operating_cost_per_km.truck.value}
                onChange={(event) => setNumeric("transport.truck_cost_per_km", Number(event.target.value))}
              />
            </article>
          </div>

          <div className="card">
            <h2>Loan Table</h2>
            <label>Baseline Term (Months)</label>
            <input
              type="number"
              step="1"
              value={draft.transportation.loan_payment_table.baseline_term_months}
              onChange={(event) => setNumeric("transport.baseline_term", Number(event.target.value))}
            />
            <label>Baseline APR (%)</label>
            <input
              type="number"
              step="0.01"
              value={draft.transportation.loan_payment_table.baseline_apr_percent}
              onChange={(event) => setNumeric("transport.baseline_apr", Number(event.target.value))}
            />
            <label htmlFor="loan-table-json">Points JSON</label>
            <textarea
              id="loan-table-json"
              value={loanPointsJson}
              onChange={(event) => setLoanPointsJson(event.target.value)}
            />
          </div>

          <div className="page-actions">
            <button type="button" onClick={() => void saveDraft()}>
              Save Constants
            </button>
            <button type="button" onClick={() => void resetDefaults()}>
              Reset To Defaults
            </button>
          </div>
          {status ? <p>{status}</p> : null}
        </>
      )}
    </section>
  );
}
