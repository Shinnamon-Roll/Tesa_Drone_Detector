import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { MainDashboard } from "./pages/MainDashboard";
import { DefensiveDashboard } from "./pages/DefensiveDashboard";
import { OffensiveDashboard } from "./pages/OffensiveDashboard";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<MainDashboard />} />
          <Route path="defensive" element={<DefensiveDashboard />} />
          <Route path="offensive" element={<OffensiveDashboard />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}


