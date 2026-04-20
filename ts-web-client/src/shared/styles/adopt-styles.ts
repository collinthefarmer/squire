/**
 * Create a CSSStyleSheet from a CSS text string.
 *
 * Caches the sheet by reference so the same CSS text imported
 * by multiple component instances shares a single sheet object.
 */
const sheetCache = new Map<string, CSSStyleSheet>();

export function cssSheet(cssText: string): CSSStyleSheet {
    let sheet = sheetCache.get(cssText);
    if (sheet) {
        return sheet;
    }

    sheet = new CSSStyleSheet();
    sheet.replaceSync(cssText);
    sheetCache.set(cssText, sheet);
    return sheet;
}
