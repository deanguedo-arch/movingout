import { Link } from "react-router-dom";
import { useAppState } from "../../app/state";

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

export function DashboardPage() {
  const { schema, submission } = useAppState();
  const requiredFields = schema.fields.filter((field) => field.required).length;
  const requiredEvidence = schema.evidence_requirements.filter((item) => item.required).length;
  const totalRequirements = requiredFields + requiredEvidence;
  const missingRequirements =
    submission.flags.missing_required_fields.length +
    submission.flags.missing_required_evidence.length;
  const completionPercent = computeCompletionPercent(totalRequirements, missingRequirements);

  return (
    <section className="page">
      <header className="page-header">
        <h1>Dashboard</h1>
        <p>
          Completion: <strong>{completionPercent}%</strong>
        </p>
      </header>

      <div className="card-grid">
        <article className="card">
          <h2>Net Income</h2>
          <p>{formatCurrency(submission.derived.net_monthly_income)}</p>
        </article>
        <article className="card">
          <h2>Total Expenses</h2>
          <p>{formatCurrency(submission.derived.total_monthly_expenses)}</p>
        </article>
        <article className="card">
          <h2>Monthly Surplus / Deficit</h2>
          <p>{formatCurrency(submission.derived.monthly_surplus)}</p>
        </article>
      </div>

      <section className="card">
        <h2>Key Readiness Flags</h2>
        <ul>
          <li>Affordability: {submission.flags.affordability_fail ? "Needs attention" : "Within target"}</li>
          <li>Budget status: {submission.flags.deficit ? "Deficit" : "Surplus"}</li>
          <li>Missing evidence count: {submission.flags.missing_required_evidence.length}</li>
        </ul>
        <p>
          <Link to="/readiness">Open readiness check</Link>
        </p>
      </section>
    </section>
  );
}
