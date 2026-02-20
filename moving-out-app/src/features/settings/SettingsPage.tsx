import { useState } from "react";
import { useAppState } from "../../app/state";

export function SettingsPage() {
  const { constants, refreshTransitSnapshot } = useAppState();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function updateTransit() {
    setBusy(true);
    setStatus("Refreshing transit fares...");
    try {
      const updated = await refreshTransitSnapshot();
      setStatus(`Transit fare snapshot updated to $${updated.toFixed(2)}.`);
    } catch (error) {
      setStatus(`Transit refresh failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>Scenario Settings (Read-Only)</h1>
        <p>These are the active assumptions used in your calculations.</p>
      </header>

      <div className="card-grid">
        <article className="card">
          <h2>Income Anchor</h2>
          <p>Default mode: {constants.income.default_mode}</p>
          <a href={constants.income.cra_pdoc_url} rel="noreferrer" target="_blank">
            CRA Payroll Deductions Online Calculator
          </a>
        </article>

        <article className="card">
          <h2>Transit Snapshot</h2>
          <ul>
            <li>Monthly pass default: ${constants.transportation.transit_monthly_pass_default.value.toFixed(2)}</li>
            <li>Last updated: {constants.transportation.transit_monthly_pass_last_updated}</li>
          </ul>
          <a href={constants.transportation.transit_monthly_pass_source_url} rel="noreferrer" target="_blank">
            Current source
          </a>
          <div className="page-actions">
            <button disabled={busy} type="button" onClick={() => void updateTransit()}>
              Update transit fares
            </button>
          </div>
          {status ? <p>{status}</p> : null}
        </article>

        <article className="card">
          <h2>Key Rules</h2>
          <ul>
            <li>Housing affordability threshold: {constants.thresholds.affordability_housing_fraction_of_net.value}</li>
            <li>Low buffer threshold: ${constants.thresholds.buffer_warning_threshold.value.toFixed(2)}</li>
            <li>Minimum vehicle price warning: ${constants.transportation.minimum_vehicle_price.value.toFixed(2)}</li>
            <li>Food weekly-to-monthly multiplier: {constants.food.weeks_per_month.value}</li>
          </ul>
        </article>
      </div>
    </section>
  );
}
