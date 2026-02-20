import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../../app/state";
import type { Constants } from "../../schema";

function deepCloneConstants(constants: Constants): Constants {
  return JSON.parse(JSON.stringify(constants)) as Constants;
}

export function TeacherPage() {
  const {
    constants,
    setConstantsOverride,
    resetConstantsToDefault,
    refreshTransitSnapshot,
    refreshMinimumWageSnapshot,
  } = useAppState();
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
        case "transport.minimum_vehicle_price":
          next.transportation.minimum_vehicle_price.value = value;
          break;
        case "transport.transit_default":
          next.transportation.transit_monthly_pass_default.value = value;
          break;
        case "transport.car_cost_per_km":
          next.transportation.operating_cost_per_km.car.value = value;
          break;
        case "transport.truck_cost_per_km":
          next.transportation.operating_cost_per_km.truck.value = value;
          break;
        case "food.weeks_per_month":
          next.food.weeks_per_month.value = value;
          break;
        case "transport.baseline_term":
          next.transportation.loan_payment_table.baseline_term_months = value;
          break;
        case "transport.baseline_apr":
          next.transportation.loan_payment_table.baseline_apr_percent = value;
          break;
        case "snapshot.gas":
          next.economic_snapshot.gas_benchmark_ab.value = value;
          break;
        case "snapshot.cpi":
          next.economic_snapshot.cpi_yoy_canada.value = value;
          break;
        default:
          break;
      }
      return next;
    });
  }

  function setText(path: string, value: string) {
    setDraft((prev) => {
      const next = deepCloneConstants(prev);
      switch (path) {
        case "snapshot.gas_source":
          next.economic_snapshot.gas_benchmark_ab.source_url = value;
          break;
        case "snapshot.gas_updated":
          next.economic_snapshot.gas_benchmark_ab.last_updated = value;
          break;
        case "snapshot.cpi_source":
          next.economic_snapshot.cpi_yoy_canada.source_url = value;
          break;
        case "snapshot.cpi_updated":
          next.economic_snapshot.cpi_yoy_canada.last_updated = value;
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

  async function refreshTransitNow() {
    setStatus("Refreshing transit snapshot...");
    try {
      const value = await refreshTransitSnapshot();
      setStatus(`Transit snapshot updated to $${value.toFixed(2)}.`);
    } catch (refreshError) {
      setStatus(`Transit refresh failed: ${(refreshError as Error).message}`);
    }
  }

  async function refreshMinimumWageNow() {
    setStatus("Refreshing Alberta minimum wage snapshot...");
    try {
      const value = await refreshMinimumWageSnapshot();
      setStatus(`Minimum wage snapshot updated to $${value.toFixed(2)}.`);
    } catch (refreshError) {
      setStatus(`Minimum wage refresh failed: ${(refreshError as Error).message}`);
    }
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
              <label>Minimum Vehicle Price</label>
              <input
                type="number"
                step="1"
                value={draft.transportation.minimum_vehicle_price.value}
                onChange={(event) => setNumeric("transport.minimum_vehicle_price", Number(event.target.value))}
              />
              <label>Default Transit Pass</label>
              <input
                type="number"
                step="0.01"
                value={draft.transportation.transit_monthly_pass_default.value}
                onChange={(event) => setNumeric("transport.transit_default", Number(event.target.value))}
              />
              <label>Food Weeks Per Month Multiplier</label>
              <input
                type="number"
                step="0.1"
                value={draft.food.weeks_per_month.value}
                onChange={(event) => setNumeric("food.weeks_per_month", Number(event.target.value))}
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

            <article className="card">
              <h2>Current Context Snapshots</h2>
              <p>
                Transit: ${draft.transportation.transit_monthly_pass_default.value.toFixed(2)} (updated {draft.transportation.transit_monthly_pass_last_updated})
              </p>
              <div className="page-actions">
                <button type="button" onClick={() => void refreshTransitNow()}>
                  Refresh Transit
                </button>
              </div>
              <p>
                Minimum wage: ${draft.economic_snapshot.minimum_wage_ab.value.toFixed(2)} (updated {draft.economic_snapshot.minimum_wage_ab.last_updated})
              </p>
              <div className="page-actions">
                <button type="button" onClick={() => void refreshMinimumWageNow()}>
                  Refresh Minimum Wage
                </button>
              </div>
              <label>Gas benchmark ($/L)</label>
              <input
                type="number"
                step="0.001"
                value={draft.economic_snapshot.gas_benchmark_ab.value}
                onChange={(event) => setNumeric("snapshot.gas", Number(event.target.value))}
              />
              <label>Gas benchmark source URL</label>
              <input
                type="text"
                value={draft.economic_snapshot.gas_benchmark_ab.source_url}
                onChange={(event) => setText("snapshot.gas_source", event.target.value)}
              />
              <label>Gas benchmark last updated</label>
              <input
                type="date"
                value={draft.economic_snapshot.gas_benchmark_ab.last_updated}
                onChange={(event) => setText("snapshot.gas_updated", event.target.value)}
              />
              <label>CPI YoY benchmark (%)</label>
              <input
                type="number"
                step="0.01"
                value={draft.economic_snapshot.cpi_yoy_canada.value}
                onChange={(event) => setNumeric("snapshot.cpi", Number(event.target.value))}
              />
              <label>CPI source URL</label>
              <input
                type="text"
                value={draft.economic_snapshot.cpi_yoy_canada.source_url}
                onChange={(event) => setText("snapshot.cpi_source", event.target.value)}
              />
              <label>CPI last updated</label>
              <input
                type="date"
                value={draft.economic_snapshot.cpi_yoy_canada.last_updated}
                onChange={(event) => setText("snapshot.cpi_updated", event.target.value)}
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
