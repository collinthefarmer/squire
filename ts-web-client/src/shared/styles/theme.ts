/**
 * Theme utilities for web components
 *
 * Provides shared color palette and design tokens.
 * All spatial values are anchored to a baseline grid via the
 * --grid-unit CSS custom property (default 0.25rem / 4px).
 */

/**
 * Return a CSS calc() expression equal to `n` baseline grid units.
 *
 * References var(--grid-unit) so all sizing scales when
 * the custom property is changed on :root.
 *
 * @example gu(3)   → "calc(var(--grid-unit) * 3)"   // 12px at default 4px unit
 * @example gu(0)   → "0"
 * @example gu(3.5) → "calc(var(--grid-unit) * 3.5)"  // 14px — half-units for type
 */
export function gu(n: number): string {
    if (n === 0) return "0";
    return `calc(var(--grid-unit) * ${n})`;
}

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
        400: "#9ca3af",
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
    xs:    gu(1),   // 4px
    sm:    gu(2),   // 8px
    md:    gu(3),   // 12px
    lg:    gu(4),   // 16px
    xl:    gu(6),   // 24px
    "2xl": gu(8),   // 32px
} as const;

export const borderRadius = {
    sm:   gu(1),    // 4px
    md:   gu(2),    // 8px
    lg:   gu(3),    // 12px
    full: "9999px",
} as const;

export const fontSize = {
    xs:    gu(2.5), // 10px — tiny labels
    sm:    gu(3),   // 12px — secondary text
    base:  gu(3.5), // 14px — body/default
    md:    gu(4),   // 16px — sub-headings
    lg:    gu(4.5), // 18px — section headers
    xl:    gu(5),   // 20px — large headers
    "2xl": gu(6),   // 24px — titles
    "3xl": gu(8),   // 32px — hero titles
} as const;

export const sizing = {
    thumbnail:     gu(30),  // 120px
    inputMin:      gu(20),  // 80px
    valueDisplay:  gu(12),  // 48px
    sidebarWidth:  gu(70),  // 280px
    maxWidth:      gu(350), // 1400px
    statusDot:     gu(2),   // 8px
    checkboxSm:    gu(4),   // 16px
    checkboxLg:    gu(5),   // 20px
    sliderThumb:   gu(4),   // 16px
    sliderTrack:   gu(2),   // 8px
    stripBtn:      gu(7),   // 28px — timeline strip buttons
    trackBlock:    gu(6),   // 24px — track block height
    trackVolume:   gu(12),  // 48px — inline volume slider width
    levelBar:      gu(10),  // 40px — summary level bar width
    levelBarH:     gu(1.5), // 6px  — summary level bar height
    volumeMax:     gu(30),  // 120px — transport volume slider max
} as const;

export const transitions = {
    fast: "all 0.15s ease",
    normal: "all 0.3s ease",
} as const;

/**
 * Compose a theme hex color with an alpha channel.
 *
 * @example alpha(colors.blue[500], 0.2) → "rgba(59, 130, 246, 0.2)"
 */
export function alpha(hex: string, opacity: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
