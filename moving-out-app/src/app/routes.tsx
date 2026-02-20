import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./AppShell";
import { PlaceholderPage } from "../features/common/PlaceholderPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { EvidencePage } from "../features/evidence/EvidencePage";
import { ReadinessPage } from "../features/readiness/ReadinessPage";
import { SectionPage } from "../features/sections/SectionPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { TeacherPage } from "../features/settings/TeacherPage";

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />} path="/">
          <Route element={<DashboardPage />} index />
          <Route element={<SectionPage />} path="sections/:sectionId" />
          <Route element={<EvidencePage />} path="evidence" />
          <Route element={<ReadinessPage />} path="readiness" />
          <Route
            element={
              <PlaceholderPage
                title="Comparison Sheet"
                message="Pinned choice comparison output will appear here in a later checkpoint."
              />
            }
            path="comparison"
          />
          <Route
            element={
              <PlaceholderPage
                title="Export / Import"
                message="ZIP export/import controls will appear here in a later checkpoint."
              />
            }
            path="transfer"
          />
          <Route element={<SettingsPage />} path="settings" />
          <Route element={<TeacherPage />} path="teacher" />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
