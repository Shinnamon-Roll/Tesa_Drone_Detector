import React from "react";
import { colorsTactical } from "./colors";

export function GaugeWidget({
    value,
    max = 100,
    min = 0,
    unit = "%",
    label,
    warn = 30,
    danger = 10,
    animated = true,
    size = "medium" // small, medium, large
}) {
    const percentage = ((value - min) / (max - min)) * 100;

    const getColor = () => {
        if (value <= danger) return colorsTactical.danger;
        if (value <= warn) return colorsTactical.warning;
        return colorsTactical.success;
    };

    const getSizeConfig = () => {
        switch (size) {
            case "small":
                return { width: 80, height: 80, fontSize: 16, labelSize: 10 };
            case "large":
                return { width: 150, height: 150, fontSize: 32, labelSize: 14 };
            default:
                return { width: 120, height: 120, fontSize: 24, labelSize: 12 };
        }
    };

    const config = getSizeConfig();
    const color = getColor();

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
            }}
        >
            {/* Circular Gauge */}
            <div
                style={{
                    position: "relative",
                    width: `${config.width}px`,
                    height: `${config.height}px`,
                }}
            >
                {/* Background circle */}
                <svg
                    width={config.width}
                    height={config.height}
                    style={{ transform: "rotate(-90deg)" }}
                >
                    <circle
                        cx={config.width / 2}
                        cy={config.height / 2}
                        r={(config.width - 10) / 2}
                        fill="none"
                        stroke={colorsTactical.bgLight}
                        strokeWidth="8"
                    />
                    {/* Progress circle */}
                    <circle
                        cx={config.width / 2}
                        cy={config.height / 2}
                        r={(config.width - 10) / 2}
                        fill="none"
                        stroke={color}
                        strokeWidth="8"
                        strokeDasharray={`${Math.PI * (config.width - 10)} ${Math.PI * (config.width - 10)}`}
                        strokeDashoffset={Math.PI * (config.width - 10) * (1 - percentage / 100)}
                        style={{
                            transition: animated ? "stroke-dashoffset 0.5s ease" : "none",
                            filter: `drop-shadow(0 0 8px ${color})`,
                        }}
                        strokeLinecap="round"
                    />
                </svg>

                {/* Center value */}
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        textAlign: "center",
                    }}
                >
                    <div
                        style={{
                            fontSize: `${config.fontSize}px`,
                            fontWeight: 700,
                            color: color,
                            fontFamily: "'Orbitron', sans-serif",
                            textShadow: `0 0 10px ${color}`,
                            lineHeight: 1,
                        }}
                    >
                        {Math.round(value)}
                    </div>
                    <div
                        style={{
                            fontSize: `${config.labelSize}px`,
                            color: colorsTactical.textSecondary,
                            marginTop: "4px",
                        }}
                    >
                        {unit}
                    </div>
                </div>

                {/* Pulsing ring for danger/warning */}
                {(value <= warn) && (
                    <div
                        style={{
                            position: "absolute",
                            top: -4,
                            left: -4,
                            width: config.width + 8,
                            height: config.height + 8,
                            borderRadius: "50%",
                            border: `2px solid ${color}`,
                            animation: "pulsering 2s ease-in-out infinite",
                            opacity: 0.5,
                        }}
                    />
                )}
            </div>

            {/* Label */}
            {label && (
                <div
                    style={{
                        fontSize: `${config.labelSize}px`,
                        color: colorsTactical.textPrimary,
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        fontWeight: 600,
                        textAlign: "center",
                    }}
                >
                    {label}
                </div>
            )}

            <style>{`
        @keyframes pulsering {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `}</style>
        </div>
    );
}
