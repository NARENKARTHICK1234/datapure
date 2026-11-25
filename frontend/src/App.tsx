import React from "react";
import { ThemeProvider } from "./context/ThemeContext";
import { DatasetProvider, useDataset } from "./context/DatasetContext";
import { AppShell } from "./components/layout/AppShell";
import { LandingPage } from "./pages/LandingPage";
import { OverviewDashboard } from "./pages/OverviewDashboard";
import { UploadDatasetPage } from "./pages/UploadDatasetPage";
import { DataProfilingPage } from "./pages/DataProfilingPage";
import { DataCleaningPage } from "./pages/DataCleaningPage";
import { StructuralValidationPage } from "./pages/StructuralValidationPage";
import { VisualAnalyticsPage } from "./pages/VisualAnalyticsPage";
import { ComparisonPage } from "./pages/ComparisonPage";
import { ReportsExportPage } from "./pages/ReportsExportPage";
import { ActivityHistoryPage } from "./pages/ActivityHistoryPage";
import { SettingsPage } from "./pages/SettingsPage";

function WorkspaceRouter() {
  const { activePage } = useDataset();

  if (activePage === "landing") {
    return <LandingPage />;
  }

  return (
    <AppShell>
      {activePage === "overview" && <OverviewDashboard />}
      {activePage === "upload" && <UploadDatasetPage />}
      {activePage === "profiling" && <DataProfilingPage />}
      {activePage === "cleaning" && <DataCleaningPage />}
      {activePage === "validation" && <StructuralValidationPage />}
      {activePage === "analytics" && <VisualAnalyticsPage />}
      {activePage === "comparison" && <ComparisonPage />}
      {activePage === "reports" && <ReportsExportPage />}
      {activePage === "history" && <ActivityHistoryPage />}
      {activePage === "settings" && <SettingsPage />}
    </AppShell>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <DatasetProvider>
        <WorkspaceRouter />
      </DatasetProvider>
    </ThemeProvider>
  );
}
