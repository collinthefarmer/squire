/**
 * Theme utilities for web components
 *
 * Provides shared color palette and design tokens
 */

export const colors = {
    // Master client dark theme
    slate: {
        900: "#0f172a",
        800: "#1e293b",
        700: "#334155",
    },
    gray: {
        900: "#111827",
        800: "#1f2937",
        700: "#374151",
        600: "#4b5563",
        500: "#6b7280",
        200: "#e5e7eb",
        100: "#f3f4f6",
        50: "#f9fafb",
    },
    blue: {
        600: "#2563eb",
        500: "#3b82f6",
        400: "#60a5fa",
    },
    green: {
        600: "#059669",
        500: "#10b981",
        400: "#4ade80",
    },
    red: {
        600: "#dc2626",
        500: "#ef4444",
    },
    amber: {
        400: "#fbbf24",
    },
    // Basic colors
    black: "#000000",
    white: "#ffffff",
} as const;

export const spacing = {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem",
    "2xl": "2rem",
} as const;

export const borderRadius = {
    sm: "0.25rem",
    md: "0.375rem",
    lg: "0.5rem",
    full: "9999px",
} as const;

export const transitions = {
    fast: "all 0.15s ease",
    normal: "all 0.3s ease",
} as const;
