import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout.jsx";
import { MainDashboard } from "./pages/MainDashboard.jsx";
import { DefensiveDashboard } from "./pages/DefensiveDashboard.jsx";
import { OffensiveDashboard } from "./pages/OffensiveDashboard.jsx";
import { SettingsPage } from "./pages/SettingsPage.jsx";

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


