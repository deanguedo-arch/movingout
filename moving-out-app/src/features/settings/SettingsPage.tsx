import { useAppState } from "../../app/state";

export function SettingsPage() {
  const { constants } = useAppState();

  return (
    <section className="page">
      <header className="page-header">
        <h1>Scenario Settings (Read-Only)</h1>
        <p>These constants are the assumptions used in your calculations.</p>
      </header>

      <div className="card-grid">
        <article className="card">
          <h2>Deductions</h2>
          <ul>
            <li>Income tax: {constants.deductions.income_tax_rate.value}</li>
            <li>CPP: {constants.deductions.cpp_rate.value}</li>
            <li>EI: {constants.deductions.ei_rate.value}</li>
            <li>Union dues: {constants.deductions.union_dues_rate.value}</li>
          </ul>
        </article>
        <article className="card">
          <h2>Thresholds</h2>
          <ul>
            <li>
              Housing affordability fraction: {constants.thresholds.affordability_housing_fraction_of_net.value}
            </li>
            <li>Buffer warning threshold: {constants.thresholds.buffer_warning_threshold.value}</li>
          </ul>
        </article>
        <article className="card">
          <h2>Transportation</h2>
          <ul>
            <li>Weeks per month: {constants.transportation.weeks_per_month.value}</li>
            <li>Default down payment: {constants.transportation.default_down_payment_fraction.value}</li>
            <li>Default term (months): {constants.transportation.default_term_months.value}</li>
            <li>Default APR: {constants.transportation.default_apr_percent.value}</li>
            <li>Operating cost/km (car): {constants.transportation.operating_cost_per_km.car.value}</li>
            <li>Operating cost/km (truck): {constants.transportation.operating_cost_per_km.truck.value}</li>
          </ul>
        </article>
      </div>
    </section>
  );
}
