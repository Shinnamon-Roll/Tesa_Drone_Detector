import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import "./AppLayout.css";

export function AppLayout() {
  return (
    <div className="layout">
      <header className="layout-header">
        <nav className="layout-nav">
          <NavLink to="/" end className="layout-link">
            Drone Dashboard
          </NavLink>
          <NavLink to="/defensive" className="layout-link">
            Defensive Dashboard
          </NavLink>
          <NavLink to="/offensive" className="layout-link">
            Offensive Dashboard
          </NavLink>
          <NavLink to="/settings" className="layout-link layout-right">
            Settings / User
          </NavLink>
        </nav>
      </header>
      <main className="layout-content">
        <Outlet />
      </main>
    </div>
  );
}


