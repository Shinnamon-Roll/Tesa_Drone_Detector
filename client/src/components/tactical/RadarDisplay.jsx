import React, { useEffect, useRef, useState } from "react";
import { colorsTactical } from "./colors";

export function RadarDisplay({
    targets = [],
    range = 10, // km
    sweepSpeed = 3, // seconds
    centerLat,
    centerLng,
    width = 300,
    height = 300
}) {
    const canvasRef = useRef(null);
    const [sweepAngle, setSweepAngle] = useState(0);

    // Animate radar sweep
    useEffect(() => {
        const interval = setInterval(() => {
            setSweepAngle((prev) => (prev + 2) % 360);
        }, (sweepSpeed * 1000) / 180); // Update frequency based on sweep speed

        return () => clearInterval(interval);
    }, [sweepSpeed]);

    // Draw radar
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 20;

        // Clear canvas
        ctx.fillStyle = colorsTactical.bgDark;
        ctx.fillRect(0, 0, width, height);

        // Draw range circles
        ctx.strokeStyle = colorsTactical.border;
        ctx.lineWidth = 1;
        for (let i = 1; i <= 4; i++) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, (radius / 4) * i, 0, Math.PI * 2);
            ctx.stroke();

            // Range labels
            ctx.fillStyle = colorsTactical.textMuted;
            ctx.font = "10px 'Orbitron', monospace";
            ctx.fillText(
                `${((range / 4) * i).toFixed(1)}km`,
                centerX + 5,
                centerY - (radius / 4) * i + 5
            );
        }

        // Draw crosshairs
        ctx.strokeStyle = colorsTactical.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - radius);
        ctx.lineTo(centerX, centerY + radius);
        ctx.moveTo(centerX - radius, centerY);
        ctx.lineTo(centerX + radius, centerY);
        ctx.stroke();

        // Draw cardinal directions
        ctx.fillStyle = colorsTactical.textPrimary;
        ctx.font = "bold 14px 'Orbitron', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("N", centerX, centerY - radius - 8);
        ctx.fillText("S", centerX, centerY + radius + 18);
        ctx.textAlign = "left";
        ctx.fillText("E", centerX + radius + 8, centerY + 5);
        ctx.textAlign = "right";
        ctx.fillText("W", centerX - radius - 8, centerY + 5);

        // Draw radar sweep
        const sweepRad = (sweepAngle * Math.PI) / 180;
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, `${colorsTactical.accent}40`);
        gradient.addColorStop(0.5, `${colorsTactical.accent}20`);
        gradient.addColorStop(1, "transparent");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, sweepRad - Math.PI / 6, sweepRad);
        ctx.closePath();
        ctx.fill();

        // Draw sweep line
        ctx.strokeStyle = colorsTactical.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + radius * Math.cos(sweepRad - Math.PI / 2),
            centerY + radius * Math.sin(sweepRad - Math.PI / 2)
        );
        ctx.stroke();

        // Draw targets
        targets.forEach((target) => {
            if (!target.lat || !target.lng) return;

            // Calculate distance and bearing from center
            const latDiff = target.lat - (centerLat || 0);
            const lngDiff = target.lng - (centerLng || 0);
            const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111; // Rough km conversion
            const bearing = (Math.atan2(lngDiff, latDiff) * 180) / Math.PI;

            if (distance > range) return; // Out of range

            const targetRadius = (distance / range) * radius;
            const targetAngle = ((90 - bearing) * Math.PI) / 180; // Convert to canvas angle
            const targetX = centerX + targetRadius * Math.cos(targetAngle);
            const targetY = centerY + targetRadius * Math.sin(targetAngle);

            // Draw target blip
            const blipSize = 6;
            ctx.fillStyle = target.hostile ? colorsTactical.danger : colorsTactical.success;
            ctx.shadowColor = target.hostile ? colorsTactical.danger : colorsTactical.success;
            ctx.shadowBlur = 10;

            ctx.beginPath();
            ctx.arc(targetX, targetY, blipSize, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;

            // Draw pulsing ring around target
            ctx.strokeStyle = target.hostile ? colorsTactical.danger : colorsTactical.success;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(targetX, targetY, blipSize + 4, 0, Math.PI * 2);
            ctx.stroke();

            // Label
            if (target.name) {
                ctx.fillStyle = colorsTactical.textSecondary;
                ctx.font = "9px 'Orbitron', sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(target.name, targetX, targetY - blipSize - 5);
            }
        });

    }, [targets, centerLat, centerLng, range, sweepAngle, width, height]);

    return (
        <div
            style={{
                position: "relative",
                width: `${width}px`,
                height: `${height}px`,
                background: colorsTactical.bgDark,
                border: `2px solid ${colorsTactical.border}`,
                borderRadius: "50%",
                boxShadow: `inset 0 0 30px ${colorsTactical.bgMedium}, ${colorsTactical.glow}`,
            }}
        >
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                style={{
                    display: "block",
                    borderRadius: "50%",
                }}
            />

            {/* Range indicator */}
            <div
                style={{
                    position: "absolute",
                    top: 5,
                    left: 5,
                    fontSize: "10px",
                    color: colorsTactical.accent,
                    fontFamily: "'Orbitron', monospace",
                    background: colorsTactical.bgGlass,
                    padding: "4px 8px",
                    borderRadius: "4px",
                    backdropFilter: "blur(5px)",
                }}
            >
                RANGE: {range}km
            </div>

            {/* Target count */}
            <div
                style={{
                    position: "absolute",
                    top: 5,
                    right: 5,
                    fontSize: "10px",
                    color: colorsTactical.accent,
                    fontFamily: "'Orbitron', monospace",
                    background: colorsTactical.bgGlass,
                    padding: "4px 8px",
                    borderRadius: "4px",
                    backdropFilter: "blur(5px)",
                }}
            >
                TARGETS: {targets.length}
            </div>
        </div>
    );
}
