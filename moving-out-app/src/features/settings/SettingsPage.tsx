import { useAppState } from "../../app/state";

function formatDate(value: string): string {
  if (!value) {
    return "Unknown";
  }
  return value;
}

export function SettingsPage() {
  const { constants } = useAppState();

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
          <h2>ETS Transit Snapshot</h2>
          <ul>
            <li>Value: ${constants.transportation.transit_monthly_pass_default.value.toFixed(2)} / month</li>
            <li>Last updated: {formatDate(constants.transportation.transit_monthly_pass_last_updated)}</li>
            <li>Status: Cached local snapshot</li>
          </ul>
          <a href={constants.transportation.transit_monthly_pass_source_url} rel="noreferrer" target="_blank">
            Source
          </a>
        </article>

        <article className="card">
          <h2>Alberta Minimum Wage Snapshot</h2>
          <ul>
            <li>Value: ${constants.economic_snapshot.minimum_wage_ab.value.toFixed(2)} / hour</li>
            <li>Last updated: {formatDate(constants.economic_snapshot.minimum_wage_ab.last_updated)}</li>
            <li>Status: Cached local snapshot</li>
          </ul>
          <a href={constants.economic_snapshot.minimum_wage_ab.source_url} rel="noreferrer" target="_blank">
            Source
          </a>
        </article>

        <article className="card">
          <h2>Alberta Gas Benchmark</h2>
          <ul>
            <li>Value: ${constants.economic_snapshot.gas_benchmark_ab.value.toFixed(3)} / L</li>
            <li>Last updated: {formatDate(constants.economic_snapshot.gas_benchmark_ab.last_updated)}</li>
            <li>Status: Cached local snapshot</li>
          </ul>
          <a href={constants.economic_snapshot.gas_benchmark_ab.source_url} rel="noreferrer" target="_blank">
            Source
          </a>
        </article>

        <article className="card">
          <h2>Canada CPI YoY Benchmark</h2>
          <ul>
            <li>Value: {constants.economic_snapshot.cpi_yoy_canada.value.toFixed(2)}%</li>
            <li>Last updated: {formatDate(constants.economic_snapshot.cpi_yoy_canada.last_updated)}</li>
            <li>Status: Cached local snapshot</li>
          </ul>
          <a href={constants.economic_snapshot.cpi_yoy_canada.source_url} rel="noreferrer" target="_blank">
            Source
          </a>
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
