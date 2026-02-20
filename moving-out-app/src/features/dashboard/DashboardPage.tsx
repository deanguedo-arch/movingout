import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppState } from "../../app/state";
import { parseFoodTableRows } from "../../rules";

const CHART_COLORS = ["#0e7a5f", "#e07a2b", "#4a5fc1", "#cc3f6d", "#2f6fca"];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
  }).format(value);
}

function computeCompletionPercent(requiredCount: number, missingCount: number): number {
  if (requiredCount <= 0) {
    return 100;
  }
  const completed = Math.max(0, requiredCount - missingCount);
  return Math.round((completed / requiredCount) * 100);
}

function asPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function tooltipCurrency(value: number | string | undefined): string {
  if (typeof value === "number") {
    return formatCurrency(value);
  }
  const parsed = Number(value ?? 0);
  return formatCurrency(Number.isFinite(parsed) ? parsed : 0);
}

export function DashboardPage() {
  const { schema, constants, submission, evidence } = useAppState();

  const requiredFields = schema.fields.filter((field) => field.required).length;
  const requiredEvidence = schema.evidence_requirements.filter((item) => item.required).length;
  const totalRequirements = requiredFields + requiredEvidence;
  const missingRequirements =
    submission.flags.missing_required_fields.length +
    submission.flags.missing_required_evidence.length;
  const completionPercent = computeCompletionPercent(totalRequirements, missingRequirements);

  const netIncome = submission.derived.net_monthly_income;
  const affordabilityRatio = submission.derived.housing.affordability_ratio;
  const affordabilityTarget = constants.thresholds.affordability_housing_fraction_of_net.value;
  const affordabilityPercent = Math.min(1, affordabilityRatio / affordabilityTarget);

  const spendingBreakdownData = [
    { name: "Housing", value: submission.derived.housing.total },
    { name: "Transportation", value: submission.derived.transportation.total },
    { name: "Essentials", value: submission.derived.living_expenses.total },
  ];

  const fixedVsVariableData = [
    {
      name: "Budget",
      fixed:
        submission.derived.housing.total +
        submission.derived.transportation.loan_payment +
        submission.derived.transportation.insurance +
        submission.derived.living_expenses.savings,
      variable:
        submission.derived.transportation.fuel_cost +
        submission.derived.living_expenses.groceries +
        submission.derived.living_expenses.recreation +
        submission.derived.living_expenses.misc,
      discretionary:
        submission.derived.housing.internet_phone +
        submission.derived.transportation.parking +
        submission.derived.living_expenses.clothing,
    },
  ];

  const foodRows = parseFoodTableRows({
    inputs: submission.inputs,
    constants,
  });
  const hasFoodSource = foodRows.some((row) => row.source_url.trim().length > 0);
  const hasHousingSource =
    String(submission.inputs.rent_source_url ?? "").trim().length > 0 ||
    String(submission.inputs.utilities_source_url ?? "").trim().length > 0;
  const transportMode = String(submission.inputs.transport_mode ?? "car");
  const hasTransportSource =
    transportMode === "transit"
      ? String(submission.inputs.transit_source_url ?? "").trim().length > 0
      : String(submission.inputs.vehicle_price_source_url ?? "").trim().length > 0;

  const categoryRows = [
    {
      category: "Housing",
      monthly: submission.derived.housing.total,
      pctNet: netIncome > 0 ? submission.derived.housing.total / netIncome : 0,
      sourceStatus: hasHousingSource ? "Sourced" : "Unsourced estimate",
      flags: submission.flags.affordability_fail ? "Housing heavy" : "OK",
    },
    {
      category: "Transportation",
      monthly: submission.derived.transportation.total,
      pctNet: netIncome > 0 ? submission.derived.transportation.total / netIncome : 0,
      sourceStatus: hasTransportSource ? "Sourced" : "Unsourced estimate",
      flags: submission.flags.low_vehicle_price ? "Vehicle below minimum" : "OK",
    },
    {
      category: "Essentials",
      monthly: submission.derived.living_expenses.total,
      pctNet: netIncome > 0 ? submission.derived.living_expenses.total / netIncome : 0,
      sourceStatus: hasFoodSource ? "Sourced" : "Unsourced estimate",
      flags: submission.flags.fragile_buffer ? "Low buffer pressure" : "OK",
    },
  ];

  const rentalEvidence = evidence.find((item) => item.type === "rental_ad");
  const vehicleEvidence = evidence.find((item) => item.type === "vehicle_ad");
  const rentalEvidenceDone =
    (rentalEvidence?.url?.trim().length ?? 0) > 0 || (rentalEvidence?.file_ids.length ?? 0) > 0;
  const vehicleEvidenceDone =
    (vehicleEvidence?.url?.trim().length ?? 0) > 0 || (vehicleEvidence?.file_ids.length ?? 0) > 0;

  return (
    <section className="page">
      <header className="page-header">
        <h1>Dashboard</h1>
        <p>
          Completion: <strong>{completionPercent}%</strong>
        </p>
      </header>

      <div className="metric-grid">
        <article className="metric-card">
          <h2>Net Income</h2>
          <p>{formatCurrency(submission.derived.net_monthly_income)}</p>
        </article>
        <article className="metric-card">
          <h2>Total Expenses</h2>
          <p>{formatCurrency(submission.derived.total_monthly_expenses)}</p>
        </article>
        <article className="metric-card">
          <h2>Buffer</h2>
          <p>{formatCurrency(submission.derived.monthly_surplus)}</p>
        </article>
        <article className="metric-card">
          <h2>Evidence Status</h2>
          <p>
            Rental: {rentalEvidenceDone ? "Complete" : "Missing"} | Vehicle:{" "}
            {vehicleEvidenceDone ? "Complete" : "Missing"}
          </p>
        </article>
      </div>

      <section className="card">
        <h2>Housing Affordability Gauge</h2>
        <p>
          Rent + utilities is {asPercent(affordabilityRatio)} of net income (target{" "}
          {asPercent(affordabilityTarget)}).
        </p>
        <div className="gauge-track">
          <div
            className={submission.flags.affordability_fail ? "gauge-fill danger" : "gauge-fill"}
            style={{ width: `${Math.min(100, Math.round(affordabilityPercent * 100))}%` }}
          />
        </div>
      </section>

      <div className="card-grid dashboard-charts">
        <article className="card">
          <h2>Spending Breakdown</h2>
          <div className="chart-box">
            <ResponsiveContainer height={260} width="100%">
              <PieChart>
                <Pie
                  data={spendingBreakdownData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  innerRadius={48}
                >
                  {spendingBreakdownData.map((entry, index) => (
                    <Cell fill={CHART_COLORS[index % CHART_COLORS.length]} key={entry.name} />
                  ))}
                </Pie>
                <Tooltip formatter={tooltipCurrency} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card">
          <h2>Fixed vs Variable vs Discretionary</h2>
          <div className="chart-box">
            <ResponsiveContainer height={260} width="100%">
              <BarChart data={fixedVsVariableData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={tooltipCurrency} />
                <Legend />
                <Bar dataKey="fixed" fill="#0e7a5f" stackId="total" />
                <Bar dataKey="variable" fill="#e07a2b" stackId="total" />
                <Bar dataKey="discretionary" fill="#4a5fc1" stackId="total" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <section className="card">
        <h2>Category Table</h2>
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Monthly Cost</th>
                <th>% of Net</th>
                <th>Source Status</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {categoryRows.map((row) => (
                <tr key={row.category}>
                  <td>{row.category}</td>
                  <td>{formatCurrency(row.monthly)}</td>
                  <td>{asPercent(row.pctNet)}</td>
                  <td>{row.sourceStatus}</td>
                  <td>{row.flags}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Quick Actions</h2>
        <div className="page-actions">
          <Link to="/readiness">Open readiness check</Link>
          <Link to="/comparison">Open compare screen</Link>
          <Link to="/transfer">Export submission package</Link>
        </div>
      </section>
    </section>
  );
}
