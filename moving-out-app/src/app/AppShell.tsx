import { NavLink, Outlet } from "react-router-dom";
import { useAppState } from "./state";

function navClassName(isActive: boolean): string {
  return isActive ? "nav-link active" : "nav-link";
}

type ProcessStep = {
  id: string;
  label: string;
  route: string;
  sectionId?: string;
};

const PROCESS_STEPS: ProcessStep[] = [
  { id: "income", label: "1. Income", route: "/sections/income", sectionId: "income" },
  { id: "housing", label: "2. Housing", route: "/sections/housing", sectionId: "housing" },
  {
    id: "transportation",
    label: "3. Transportation",
    route: "/sections/transportation",
    sectionId: "transportation",
  },
  {
    id: "living_expenses",
    label: "4. Essentials",
    route: "/sections/living_expenses",
    sectionId: "living_expenses",
  },
  { id: "comparison", label: "5. Compare", route: "/comparison" },
  { id: "submit", label: "6. Submit", route: "/transfer" },
];

function getStepStatusLabel(args: {
  step: ProcessStep;
  missingFieldIds: string[];
  sectionFieldIds: string[];
  affordabilityFail: boolean;
  deficit: boolean;
  missingEvidenceCount: number;
}): string {
  const {
    step,
    missingFieldIds,
    sectionFieldIds,
    affordabilityFail,
    deficit,
    missingEvidenceCount,
  } = args;
  const sectionMissing = missingFieldIds.filter((id) => sectionFieldIds.includes(id)).length;

  if (step.id === "housing" && affordabilityFail) {
    return "Housing heavy";
  }
  if (step.id === "comparison" && deficit) {
    return "Deficit";
  }
  if (step.id === "submit" && missingEvidenceCount > 0) {
    return "Missing evidence";
  }
  if (sectionMissing > 0) {
    return `${sectionMissing} missing`;
  }
  return "Ready";
}

export function AppShell() {
  const { loading, schema, submission } = useAppState();

  if (loading) {
    return (
      <main className="app-loading">
        <p>Loading assignment data...</p>
      </main>
    );
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h2>Moving Out Project</h2>
        <nav className="sidebar-nav">
          <NavLink className={({ isActive }) => navClassName(isActive)} to="/">
            Dashboard
          </NavLink>

          <div className="sidebar-group">
            <p className="sidebar-group-title">Sections</p>
            {schema.sections.map((section) => (
              <NavLink
                className={({ isActive }) => navClassName(isActive)}
                key={section.id}
                to={`/sections/${section.id}`}
              >
                {section.title}
              </NavLink>
            ))}
          </div>

          <NavLink className={({ isActive }) => navClassName(isActive)} to="/evidence">
            Evidence Center
          </NavLink>
          <NavLink className={({ isActive }) => navClassName(isActive)} to="/readiness">
            Readiness Check
          </NavLink>
          <NavLink className={({ isActive }) => navClassName(isActive)} to="/comparison">
            Comparison Sheet
          </NavLink>
          <NavLink className={({ isActive }) => navClassName(isActive)} to="/transfer">
            Export / Import
          </NavLink>
          <NavLink className={({ isActive }) => navClassName(isActive)} to="/settings">
            Scenario Settings
          </NavLink>
          <NavLink className={({ isActive }) => navClassName(isActive)} to="/teacher">
            Teacher Mode
          </NavLink>
        </nav>
      </aside>

      <main className="content">
        <section className="process-bar">
          {PROCESS_STEPS.map((step) => {
            const sectionFieldIds = step.sectionId
              ? schema.fields
                  .filter((field) => field.section_id === step.sectionId && field.role !== "derived")
                  .map((field) => field.id)
              : [];
            const sectionRequiredCount = step.sectionId
              ? schema.fields.filter(
                  (field) =>
                    field.section_id === step.sectionId &&
                    field.required &&
                    field.role !== "derived",
                ).length
              : 1;
            const sectionMissing = step.sectionId
              ? submission.flags.missing_required_fields.filter((id) =>
                  sectionFieldIds.includes(id),
                ).length
              : step.id === "submit"
                ? submission.flags.missing_required_evidence.length
                : 0;
            const completion = Math.max(
              0,
              Math.round(
                ((sectionRequiredCount - sectionMissing) / sectionRequiredCount) * 100,
              ),
            );
            const statusLabel = getStepStatusLabel({
              step,
              missingFieldIds: submission.flags.missing_required_fields,
              sectionFieldIds,
              affordabilityFail: submission.flags.affordability_fail,
              deficit: submission.flags.deficit,
              missingEvidenceCount: submission.flags.missing_required_evidence.length,
            });

            return (
              <NavLink
                className={({ isActive }) =>
                  isActive ? "process-step active" : "process-step"
                }
                key={step.id}
                to={step.route}
              >
                <span className="process-title">{step.label}</span>
                <span className="process-meta">{completion}%</span>
                <span className="process-status">{statusLabel}</span>
              </NavLink>
            );
          })}
        </section>
        <Outlet />
      </main>
    </div>
  );
}
