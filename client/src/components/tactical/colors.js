// Tactical Military Color System
export const colorsTactical = {
    // Primary Colors
    primary: "#4A5D23",
    primaryLight: "#6B8E23",
    primaryDark: "#3A4D13",

    // Accent Colors (Neon Green)
    accent: "#0FFF50",
    accentGlow: "rgba(15, 255, 80, 0.5)",
    accentDim: "#0AAA35",

    // Status Colors
    active: "#00FF41",  // Matrix green
    standby: "#FFD700", // Gold
    offline: "#FF4444", // Red
    warning: "#FFA500", // Orange
    danger: "#FF0000",  // Red
    success: "#00FF00", // Green
    info: "#00BFFF",    // Deep sky blue

    // Background Colors
    bgDark: "#0A0E0A",      // Almost black with green tint
    bgMedium: "#1A1F1A",    // Dark green-gray
    bgLight: "#2A2F2A",     // Medium green-gray
    bgGlass: "rgba(42, 47, 42, 0.7)",  // Glassmorphism
    bgGlassLight: "rgba(52, 57, 52, 0.5)",

    // Text Colors
    textPrimary: "#E8FFE8",    // Light green-white
    textSecondary: "#A8C8A8",  // Medium green
    textMuted: "#688868",      // Muted green
    textDanger: "#FF6666",     // Light red
    textSuccess: "#66FF66",    // Light green

    // Border Colors
    border: "#556B2F",         // Forest green
    borderLight: "#6B8E3F",
    borderGlow: "#0FFF50",

    // Effects
    glow: "0 0 10px rgba(15, 255, 80, 0.5)",
    glowStrong: "0 0 20px rgba(15, 255, 80, 0.8)",
    glowDanger: "0 0 15px rgba(255, 68, 68, 0.6)",
    glowSuccess: "0 0 15px rgba(0, 255, 65, 0.6)",
    scanline: "rgba(0, 255, 65, 0.05)",

    // Gradients
    gradientPrimary: "linear-gradient(135deg, #2A2F2A 0%, #3A3F3A 100%)",
    gradientAccent: "linear-gradient(135deg, #0FFF50 0%, #00AA35 100%)",
    gradientDanger: "linear-gradient(135deg, #FF4444 0%, #AA0000 100%)",
    gradientGlass: "linear-gradient(135deg, rgba(42, 47, 42, 0.8) 0%, rgba(52, 57, 52, 0.6) 100%)",
};

// Legacy colors for backward compatibility
export const colors = {
    primary: "#4A5D23",
    secondary: "#6B8E23",
    accent: "#8B9A46",
    warning: "#DAA520",
    danger: "#8B0000",
    success: "#2F4F2F",
    bgDark: "#1C1F1A",
    bgMedium: "#2D3028",
    bgLight: "#3A3D35",
    text: "#E8E8D3",
    textSecondary: "#B8B8A3",
    border: "#556B2F",
};
