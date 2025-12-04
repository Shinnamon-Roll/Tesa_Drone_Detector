import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { colorsTactical } from "../components/tactical";
import "./AppLayout.css";

export function AppLayout() {
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Get page title based on route
  const getPageTitle = () => {
    if (location.pathname === "/defensive") return "🛡️ DEFENSIVE OPERATIONS";
    if (location.pathname === "/offensive") return "⚔️ OFFENSIVE OPERATIONS";
    if (location.pathname === "/settings") return "⚙️ SYSTEM SETTINGS";
    return "🎯 TESA TACTICAL COMMAND";
  };

  return (
    <div className="layout">
      {/* Tactical Header */}
      <header style={{
        background: colorsTactical.bgGlass,
        backdropFilter: "blur(15px)",
        borderBottom: `3px solid ${colorsTactical.accent}`,
        padding: "15px 30px",
        boxShadow: `0 4px 30px ${colorsTactical.accent}40, inset 0 1px 0 rgba(255,255,255,0.1)`
      }}>
        {/* Top Row - Title and Time */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "15px"
        }}>
          {/* Left: Title */}
          <div>
            <h1 style={{
              margin: 0,
              fontSize: "28px",
              color: colorsTactical.accent,
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "3px",
              textShadow: colorsTactical.glowStrong,
              lineHeight: 1
            }}>
              {getPageTitle()}
            </h1>
            <div style={{
              fontSize: "11px",
              color: colorsTactical.textSecondary,
              fontFamily: "'Orbitron', monospace",
              marginTop: "4px",
              letterSpacing: "2px"
            }}>
              INTEGRATED DEFENSE OPERATIONS CENTER
            </div>
          </div>

          {/* Right: Live indicators */}
          <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
            {/* Live clock */}
            <div style={{ textAlign: "right" }}>
              <div style={{
                fontSize: "24px",
                fontFamily: "'Orbitron', monospace",
                color: colorsTactical.accent,
                fontWeight: 700,
                textShadow: colorsTactical.glow,
                letterSpacing: "2px"
              }}>
                {currentTime.toLocaleTimeString('en-US', { hour12: false })}
              </div>
              <div style={{
                fontSize: "10px",
                color: colorsTactical.textSecondary,
                fontFamily: "'Orbitron', monospace",
                letterSpacing: "1px"
              }}>
                {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>

            {/* Live status */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              background: `${colorsTactical.success}20`,
              border: `2px solid ${colorsTactical.success}`,
              borderRadius: "6px",
              boxShadow: colorsTactical.glowSuccess
            }}>
              <div style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: colorsTactical.success,
                boxShadow: `0 0 10px ${colorsTactical.success}`,
                animation: "pulse 2s ease-in-out infinite"
              }} />
              <span style={{
                fontSize: "14px",
                fontWeight: 700,
                color: colorsTactical.success,
                fontFamily: "'Orbitron', sans-serif",
                letterSpacing: "1px"
              }}>
                LIVE
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Row */}
        <nav style={{
          display: "flex",
          gap: "24px",
          padding: "12px 0",
          borderTop: `1px solid ${colorsTactical.border}`,
          borderBottom: `1px solid ${colorsTactical.border}`
        }}>
          <NavLink
            to="/"
            end
            style={({ isActive }) => ({
              color: isActive ? colorsTactical.accent : colorsTactical.textSecondary,
              textDecoration: "none",
              padding: "8px 16px",
              borderRadius: "4px",
              border: isActive ? `2px solid ${colorsTactical.accent}` : "2px solid transparent",
              background: isActive ? `${colorsTactical.accent}20` : "transparent",
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: isActive ? 700 : 600,
              fontSize: "13px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              transition: "all 0.2s",
              boxShadow: isActive ? colorsTactical.glow : "none"
            })}
          >
            🎯 Drone Dashboard
          </NavLink>
          <NavLink
            to="/defensive"
            style={({ isActive }) => ({
              color: isActive ? colorsTactical.accent : colorsTactical.textSecondary,
              textDecoration: "none",
              padding: "8px 16px",
              borderRadius: "4px",
              border: isActive ? `2px solid ${colorsTactical.accent}` : "2px solid transparent",
              background: isActive ? `${colorsTactical.accent}20` : "transparent",
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: isActive ? 700 : 600,
              fontSize: "13px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              transition: "all 0.2s",
              boxShadow: isActive ? colorsTactical.glow : "none"
            })}
          >
            🛡️ Defensive
          </NavLink>
          <NavLink
            to="/offensive"
            style={({ isActive }) => ({
              color: isActive ? colorsTactical.accent : colorsTactical.textSecondary,
              textDecoration: "none",
              padding: "8px 16px",
              borderRadius: "4px",
              border: isActive ? `2px solid ${colorsTactical.accent}` : "2px solid transparent",
              background: isActive ? `${colorsTactical.accent}20` : "transparent",
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: isActive ? 700 : 600,
              fontSize: "13px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              transition: "all 0.2s",
              boxShadow: isActive ? colorsTactical.glow : "none"
            })}
          >
            ⚔️ Offensive
          </NavLink>
          <NavLink
            to="/settings"
            style={({ isActive }) => ({
              color: isActive ? colorsTactical.accent : colorsTactical.textSecondary,
              textDecoration: "none",
              padding: "8px 16px",
              borderRadius: "4px",
              border: isActive ? `2px solid ${colorsTactical.accent}` : "2px solid transparent",
              background: isActive ? `${colorsTactical.accent}20` : "transparent",
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: isActive ? 700 : 600,
              fontSize: "13px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              transition: "all 0.2s",
              boxShadow: isActive ? colorsTactical.glow : "none",
              marginLeft: "auto"
            })}
          >
            ⚙️ Settings
          </NavLink>
        </nav>
      </header>
      <main className="layout-content" style={{ padding: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}


