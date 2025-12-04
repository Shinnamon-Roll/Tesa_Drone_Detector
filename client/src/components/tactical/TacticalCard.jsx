import React from "react";
import { colorsTactical } from "./colors";

export function TacticalCard({
    title,
    icon,
    status = "normal",
    glowing = false,
    refreshable = false,
    onRefresh,
    children,
    style = {},
    headerAction
}) {
    const getStatusColor = () => {
        switch (status) {
            case "active": return colorsTactical.active;
            case "warning": return colorsTactical.warning;
            case "danger": return colorsTactical.danger;
            case "success": return colorsTactical.success;
            default: return colorsTactical.accent;
        }
    };

    return (
        <div
            style={{
                background: colorsTactical.bgGlass,
                backdropFilter: "blur(10px)",
                border: `2px solid ${glowing ? colorsTactical.borderGlow : colorsTactical.border}`,
                borderRadius: "8px",
                padding: "20px",
                boxShadow: glowing
                    ? `${colorsTactical.glowStrong}, inset 0 1px 0 rgba(255,255,255,0.1)`
                    : "0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
                position: "relative",
                overflow: "hidden",
                ...style,
            }}
        >
            {/* Scanline effect */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "2px",
                    background: `linear-gradient(90deg, transparent, ${colorsTactical.scanline}, transparent)`,
                    animation: "scanlineMove 3s linear infinite",
                }}
            />

            {/* Header */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                    paddingBottom: "12px",
                    borderBottom: `2px solid ${getStatusColor()}`,
                }}
            >
                <h2
                    style={{
                        margin: 0,
                        fontSize: "14px",
                        color: colorsTactical.textPrimary,
                        fontFamily: "'Orbitron', sans-serif",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "1.5px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                    }}
                >
                    {icon && <span>{icon}</span>}
                    {title}
                </h2>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {headerAction}
                    {refreshable && onRefresh && (
                        <button
                            onClick={onRefresh}
                            style={{
                                background: "transparent",
                                border: `1px solid ${colorsTactical.border}`,
                                borderRadius: "4px",
                                padding: "4px 8px",
                                color: colorsTactical.accent,
                                cursor: "pointer",
                                fontSize: "12px",
                                transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.background = colorsTactical.bgLight;
                                e.target.style.borderColor = colorsTactical.accent;
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = "transparent";
                                e.target.style.borderColor = colorsTactical.border;
                            }}
                        >
                            ↻
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div>{children}</div>

            {/* Corner accents */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "12px",
                    height: "12px",
                    borderTop: `2px solid ${getStatusColor()}`,
                    borderLeft: `2px solid ${getStatusColor()}`,
                }}
            />
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: "12px",
                    height: "12px",
                    borderTop: `2px solid ${getStatusColor()}`,
                    borderRight: `2px solid ${getStatusColor()}`,
                }}
            />
            <div
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    width: "12px",
                    height: "12px",
                    borderBottom: `2px solid ${getStatusColor()}`,
                    borderLeft: `2px solid ${getStatusColor()}`,
                }}
            />
            <div
                style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: "12px",
                    height: "12px",
                    borderBottom: `2px solid ${getStatusColor()}`,
                    borderRight: `2px solid ${getStatusColor()}`,
                }}
            />

            <style>{`
        @keyframes scanlineMove {
          0% { top: 0%; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
        </div>
    );
}
