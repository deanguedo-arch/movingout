import { NavLink, Outlet } from "react-router-dom";
import { useAppState } from "./state";

function navClassName(isActive: boolean): string {
  return isActive ? "nav-link active" : "nav-link";
}

export function AppShell() {
  const { loading, schema } = useAppState();

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
        <Outlet />
      </main>
    </div>
  );
}
