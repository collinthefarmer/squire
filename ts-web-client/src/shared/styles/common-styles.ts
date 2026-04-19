/**
 * Common CSS styles for web components
 *
 * Provides reusable style blocks that can be composed in component templates
 */

import { colors, spacing, borderRadius, transitions, alpha, fontSize, sizing } from "@styles/theme";

/**
 * Base reset styles for select elements
 */
export function selectStyles(): string {
    return `
        select {
            padding: ${spacing.sm};
            background: ${colors.gray[800]};
            color: ${colors.gray[200]};
            border: 1px solid ${colors.gray[700]};
            border-radius: ${borderRadius.md};
            transition: ${transitions.fast};
        }

        select:hover {
            border-color: ${colors.gray[600]};
        }

        select:focus {
            outline: none;
            border-color: ${colors.blue[500]};
            box-shadow: 0 0 0 3px ${alpha(colors.blue[500], 0.1)};
        }
    `;
}

/**
 * Base styles for text input elements
 */
export function inputStyles(): string {
    return `
        input[type="text"],
        input[type="number"] {
            padding: ${spacing.sm};
            background: ${colors.gray[800]};
            color: ${colors.gray[200]};
            border: 1px solid ${colors.gray[700]};
            border-radius: ${borderRadius.md};
            transition: ${transitions.fast};
        }

        input[type="text"]:hover,
        input[type="number"]:hover {
            border-color: ${colors.gray[600]};
        }

        input[type="text"]:focus,
        input[type="number"]:focus {
            outline: none;
            border-color: ${colors.blue[500]};
            box-shadow: 0 0 0 3px ${alpha(colors.blue[500], 0.1)};
        }
    `;
}

/**
 * Base styles for range slider inputs
 */
export function rangeInputStyles(): string {
    return `
        input[type="range"] {
            height: ${sizing.sliderTrack};
            background: ${colors.gray[800]};
            border-radius: ${borderRadius.sm};
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
        }

        input[type="range"]::-webkit-slider-thumb {
            appearance: none;
            -webkit-appearance: none;
            width: ${sizing.sliderThumb};
            height: ${sizing.sliderThumb};
            background: ${colors.blue[500]};
            border-radius: ${borderRadius.full};
            cursor: pointer;
        }

        input[type="range"]::-moz-range-thumb {
            width: ${sizing.sliderThumb};
            height: ${sizing.sliderThumb};
            background: ${colors.blue[500]};
            border: none;
            border-radius: ${borderRadius.full};
            cursor: pointer;
        }
    `;
}

/**
 * Base styles for checkbox inputs
 */
export function checkboxStyles(): string {
    return `
        input[type="checkbox"] {
            width: ${sizing.checkboxLg};
            height: ${sizing.checkboxLg};
            cursor: pointer;
            accent-color: ${colors.blue[500]};
        }
    `;
}

/**
 * Primary button styles (blue accent)
 */
export function primaryButtonStyles(): string {
    return `
        button.primary {
            padding: ${spacing.sm} ${spacing.lg};
            background: ${colors.blue[500]};
            color: ${colors.white};
            border: none;
            border-radius: ${borderRadius.md};
            cursor: pointer;
            font-weight: 500;
            transition: ${transitions.fast};
        }

        button.primary:hover {
            background: ${colors.blue[600]};
        }

        button.primary:active {
            background: ${colors.blue[600]};
            transform: translateY(1px);
        }

        button.primary:disabled {
            background: ${colors.gray[600]};
            cursor: not-allowed;
            opacity: 0.5;
        }
    `;
}

/**
 * Secondary button styles (gray background)
 */
export function secondaryButtonStyles(): string {
    return `
        button.secondary {
            padding: ${spacing.sm} ${spacing.lg};
            background: ${colors.gray[800]};
            color: ${colors.gray[200]};
            border: 1px solid ${colors.gray[700]};
            border-radius: ${borderRadius.md};
            cursor: pointer;
            transition: ${transitions.fast};
        }

        button.secondary:hover {
            background: ${colors.gray[700]};
            border-color: ${colors.gray[600]};
        }

        button.secondary:active {
            transform: translateY(1px);
        }

        button.secondary:disabled {
            cursor: not-allowed;
            opacity: 0.5;
        }
    `;
}

/**
 * Success button styles (green)
 */
export function successButtonStyles(): string {
    return `
        button.success {
            padding: ${spacing.sm} ${spacing.lg};
            background: ${colors.green[600]};
            color: ${colors.white};
            border: none;
            border-radius: ${borderRadius.md};
            cursor: pointer;
            font-weight: 500;
            transition: ${transitions.fast};
        }

        button.success:hover {
            background: ${colors.green[500]};
        }

        button.success:active {
            transform: translateY(1px);
        }

        button.success:disabled {
            background: ${colors.gray[600]};
            cursor: not-allowed;
            opacity: 0.5;
        }
    `;
}

/**
 * Danger button styles (red)
 */
export function dangerButtonStyles(): string {
    return `
        button.danger {
            padding: ${spacing.sm} ${spacing.lg};
            background: ${colors.red[600]};
            color: ${colors.white};
            border: none;
            border-radius: ${borderRadius.md};
            cursor: pointer;
            font-weight: 500;
            transition: ${transitions.fast};
        }

        button.danger:hover {
            background: ${colors.red[500]};
        }

        button.danger:active {
            transform: translateY(1px);
        }

        button.danger:disabled {
            background: ${colors.gray[600]};
            cursor: not-allowed;
            opacity: 0.5;
        }
    `;
}

/**
 * Card container styles
 */
export function cardStyles(): string {
    return `
        .card {
            background: ${colors.gray[900]};
            border: 1px solid ${colors.gray[700]};
            border-radius: ${borderRadius.lg};
            padding: ${spacing.xl};
        }
    `;
}

/**
 * Label styles
 */
export function labelStyles(): string {
    return `
        label {
            display: block;
            font-size: ${fontSize.base};
            font-weight: 500;
            color: ${colors.gray[200]};
            margin-bottom: ${spacing.xs};
        }
    `;
}

/**
 * Flex row utility
 */
export function flexRow(gap: string = spacing.md): string {
    return `
        .flex-row {
            display: flex;
            flex-direction: row;
            gap: ${gap};
            align-items: center;
        }
    `;
}

/**
 * Flex column utility
 */
export function flexColumn(gap: string = spacing.md): string {
    return `
        .flex-col {
            display: flex;
            flex-direction: column;
            gap: ${gap};
        }
    `;
}

/**
 * Grid utility
 */
export function grid(columns: string = "1fr", gap: string = spacing.md): string {
    return `
        .grid {
            display: grid;
            grid-template-columns: ${columns};
            gap: ${gap};
        }
    `;
}

/**
 * Container/card section styles
 */
export function containerStyles(): string {
    return `
        .container {
            background: ${colors.gray[900]};
            border: 1px solid ${colors.gray[700]};
            border-radius: ${borderRadius.lg};
            padding: ${spacing.xl};
        }
    `;
}

/**
 * Section header with bottom border
 */
export function sectionHeaderStyles(): string {
    return `
        .section-header {
            font-size: ${fontSize.xl};
            font-weight: 600;
            padding-bottom: ${spacing.md};
            margin-bottom: ${spacing.lg};
            border-bottom: 2px solid ${colors.gray[700]};
        }
    `;
}

/**
 * Small section title
 */
export function sectionTitleStyles(): string {
    return `
        .section-title {
            font-size: ${fontSize.md};
            font-weight: 600;
            margin-bottom: ${spacing.md};
            color: ${colors.gray[100]};
        }
    `;
}

/**
 * Right-aligned value display
 */
export function valueDisplayStyles(): string {
    return `
        .value-display {
            min-width: ${sizing.valueDisplay};
            text-align: right;
            font-size: ${fontSize.base};
            color: ${colors.gray[500]};
        }
    `;
}

/**
 * Horizontal divider
 */
export function dividerStyles(): string {
    return `
        .divider {
            height: 1px;
            background: ${colors.gray[700]};
            margin: ${spacing.lg} 0;
        }
    `;
}

/**
 * Slider row layout (label + slider + value)
 */
export function sliderRowStyles(): string {
    return `
        .slider-row {
            display: flex;
            align-items: center;
            gap: ${spacing.md};
        }

        .slider-row label {
            min-width: ${sizing.inputMin};
        }

        .slider-row input[type="range"] {
            flex: 1;
        }
    `;
}

/**
 * Outline button — transparent bg with border, for secondary actions
 */
export function outlineButtonStyles(): string {
    return `
        .outline-button {
            background: transparent;
            border: 1px solid ${colors.gray[600]};
            color: ${colors.gray[200]};
            padding: ${spacing.xs} ${spacing.sm};
            border-radius: ${borderRadius.sm};
            font-size: ${fontSize.sm};
            cursor: pointer;
            transition: ${transitions.fast};
        }

        .outline-button:hover {
            background: ${colors.gray[700]};
            border-color: ${colors.gray[500]};
        }
    `;
}

/**
 * Header row — space-between flex for a title with inline actions
 */
export function headerRowStyles(): string {
    return `
        .header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: ${spacing.sm};
        }
    `;
}

/**
 * Segmented button group — mutually exclusive toggle buttons
 */
export function segmentedButtonStyles(): string {
    return `
        .button-group {
            display: flex;
            border-radius: ${borderRadius.md};
            overflow: hidden;
            border: 1px solid ${colors.gray[600]};
        }

        .button-group .option {
            padding: ${spacing.sm} ${spacing.md};
            background: ${colors.gray[800]};
            color: ${colors.gray[200]};
            border: none;
            font-size: ${fontSize.sm};
            font-weight: 500;
            cursor: pointer;
            transition: ${transitions.fast};
            flex: 1;
            text-align: center;
        }

        .button-group .option:not(:last-child) {
            border-right: 1px solid ${colors.gray[600]};
        }

        .button-group .option:hover:not(.selected) {
            background: ${colors.gray[700]};
        }

        .button-group .option.selected {
            background: ${colors.blue[600]};
            color: ${colors.white};
        }

        .button-group .option:focus {
            outline: none;
            box-shadow: inset 0 0 0 2px ${colors.blue[400]};
        }
    `;
}
