#!/bin/bash
# Migrate a component from inline getStyles() to a separate CSS file.
# Usage: ./scripts/migrate-css.sh path/to/component.ts

set -euo pipefail

TS_FILE="$1"
CSS_FILE="${TS_FILE%.ts}.css"
BASENAME=$(basename "$TS_FILE" .ts)

if [ ! -f "$TS_FILE" ]; then
    echo "File not found: $TS_FILE"
    exit 1
fi

if [ -f "$CSS_FILE" ]; then
    echo "CSS file already exists: $CSS_FILE — skipping"
    exit 0
fi

echo "Migrating: $TS_FILE"

python3 - "$TS_FILE" "$CSS_FILE" "$BASENAME" << 'PYEOF'
import re, sys, os

ts_file = sys.argv[1]
css_file = sys.argv[2]
basename = sys.argv[3]

# Convert kebab-case to camelCase for JS variable name
def to_camel(name):
    parts = name.split("-")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])

var_name = to_camel(basename) + "Css"

with open(ts_file, "r") as f:
    content = f.read()

# --- STEP 1: Extract CSS from getStyles() ---

match = re.search(r'getStyles\(\):\s*string\s*\{\s*return\s*`(.*?)`\s*;\s*\}', content, re.DOTALL)
if not match:
    print(f"ERROR: Could not find getStyles() in {ts_file}", file=sys.stderr)
    sys.exit(1)

css = match.group(1)

# --- STEP 2: Replace JS interpolations with CSS variables ---

# Color lookup for alpha() conversion
color_map = {
    "slate": {"900": "#0f172a", "800": "#1e293b", "700": "#334155"},
    "gray": {"900": "#111827", "800": "#1f2937", "700": "#374151", "600": "#4b5563",
             "500": "#6b7280", "400": "#9ca3af", "200": "#e5e7eb", "100": "#f3f4f6", "50": "#f9fafb"},
    "blue": {"600": "#2563eb", "500": "#3b82f6", "400": "#60a5fa"},
    "green": {"600": "#059669", "500": "#10b981", "400": "#4ade80"},
    "red": {"600": "#dc2626", "500": "#ef4444"},
    "amber": {"400": "#fbbf24"},
}
plain_colors = {"black": "#000000", "white": "#ffffff"}

def hex_to_rgb(h):
    h = h.lstrip("#")
    return f"{int(h[0:2], 16)}, {int(h[2:4], 16)}, {int(h[4:6], 16)}"

# Simple token replacements
simple = [
    # Colors with bracket notation
    (r'\$\{colors\.(\w+)\[(\d+)\]\}', lambda m: f"var(--color-{m.group(1)}-{m.group(2)})"),
    (r'\$\{colors\.(\w+)\}', lambda m: f"var(--color-{m.group(1)})"),
    # Alpha helper
    (r'\$\{alpha\(colors\.(\w+)\[(\d+)\],\s*([\d.]+)\)\}',
     lambda m: f"rgba({hex_to_rgb(color_map.get(m.group(1), {}).get(m.group(2), '#000'))}, {m.group(3)})"),
    (r'\$\{alpha\(colors\.(\w+),\s*([\d.]+)\)\}',
     lambda m: f"rgba({hex_to_rgb(plain_colors.get(m.group(1), '#000'))}, {m.group(2)})"),
    # Spacing
    (r'\$\{spacing\.xs\}', "var(--spacing-xs)"),
    (r'\$\{spacing\.sm\}', "var(--spacing-sm)"),
    (r'\$\{spacing\.md\}', "var(--spacing-md)"),
    (r'\$\{spacing\.lg\}', "var(--spacing-lg)"),
    (r'\$\{spacing\.xl\}', "var(--spacing-xl)"),
    (r'\$\{spacing\["2xl"\]\}', "var(--spacing-2xl)"),
    # Border radius
    (r'\$\{borderRadius\.sm\}', "var(--radius-sm)"),
    (r'\$\{borderRadius\.md\}', "var(--radius-md)"),
    (r'\$\{borderRadius\.lg\}', "var(--radius-lg)"),
    (r'\$\{borderRadius\.full\}', "var(--radius-full)"),
    # Font sizes
    (r'\$\{fontSize\.xs\}', "var(--font-xs)"),
    (r'\$\{fontSize\.sm\}', "var(--font-sm)"),
    (r'\$\{fontSize\.base\}', "var(--font-base)"),
    (r'\$\{fontSize\.md\}', "var(--font-md)"),
    (r'\$\{fontSize\.lg\}', "var(--font-lg)"),
    (r'\$\{fontSize\.xl\}', "var(--font-xl)"),
    (r'\$\{fontSize\["2xl"\]\}', "var(--font-2xl)"),
    (r'\$\{fontSize\["3xl"\]\}', "var(--font-3xl)"),
    # Sizing
    (r'\$\{sizing\.thumbnail\}', "var(--sizing-thumbnail)"),
    (r'\$\{sizing\.inputMin\}', "var(--sizing-input-min)"),
    (r'\$\{sizing\.valueDisplay\}', "var(--sizing-value-display)"),
    (r'\$\{sizing\.sidebarWidth\}', "var(--sizing-sidebar)"),
    (r'\$\{sizing\.maxWidth\}', "var(--sizing-max-width)"),
    (r'\$\{sizing\.statusDot\}', "var(--sizing-status-dot)"),
    (r'\$\{sizing\.checkboxSm\}', "var(--sizing-checkbox-sm)"),
    (r'\$\{sizing\.checkboxLg\}', "var(--sizing-checkbox-lg)"),
    (r'\$\{sizing\.sliderThumb\}', "var(--sizing-slider-thumb)"),
    (r'\$\{sizing\.sliderTrack\}', "var(--sizing-slider-track)"),
    (r'\$\{sizing\.stripBtn\}', "var(--sizing-strip-btn)"),
    (r'\$\{sizing\.trackBlock\}', "var(--sizing-track-block)"),
    (r'\$\{sizing\.trackVolume\}', "var(--sizing-track-volume)"),
    (r'\$\{sizing\.levelBar\}', "var(--sizing-level-bar)"),
    (r'\$\{sizing\.levelBarH\}', "var(--sizing-level-bar-h)"),
    (r'\$\{sizing\.volumeMax\}', "var(--sizing-volume-max)"),
    # Transitions
    (r'\$\{transitions\.fast\}', "var(--transition-fast)"),
    (r'\$\{transitions\.normal\}', "var(--transition-normal)"),
]

for pattern, replacement in simple:
    if callable(replacement):
        css = re.sub(pattern, replacement, css)
    else:
        css = re.sub(pattern, replacement, css)

# Remove common-styles function calls — they expand to CSS class rules
# Pattern: ${functionName()} or ${functionName(args)}
css = re.sub(r'\$\{[a-zA-Z]+\([^)]*\)\}', '', css)

# Warn about remaining interpolations
remaining = re.findall(r'\$\{[^}]+\}', css)
if remaining:
    for r in remaining:
        print(f"  WARNING: Unconverted: {r}", file=sys.stderr)

# Clean up: dedent and trim
lines = css.split("\n")
while lines and not lines[0].strip():
    lines.pop(0)
while lines and not lines[-1].strip():
    lines.pop()
if lines:
    min_indent = min((len(l) - len(l.lstrip())) for l in lines if l.strip())
    lines = [l[min_indent:] if len(l) >= min_indent else l for l in lines]
# Remove blank lines at start/end of blocks
css_out = "\n".join(lines).strip() + "\n"

# Write CSS file
with open(css_file, "w") as f:
    f.write(css_out)
print(f"  Created: {css_file}")

# --- STEP 3: Update TypeScript file ---

# Remove the getStyles() method
content = re.sub(
    r'\n\s*protected\s+override\s+getStyles\(\):\s*string\s*\{\s*return\s*`.*?`\s*;\s*\}\s*',
    '\n',
    content,
    flags=re.DOTALL
)

# Remove ${this.styleTag(this.getStyles())} from render
content = re.sub(r'\$\{this\.styleTag\(this\.getStyles\(\)\)\}\s*\n?', '', content)

# Add CSS import — find last import line
import_matches = list(re.finditer(r'^(import\s.+;)$', content, re.MULTILINE))
if import_matches:
    last_pos = import_matches[-1].end()
    css_import = f'\n\n// @ts-expect-error — Bun imports CSS as text\nimport {var_name} from "./{basename}.css" with {{ type: "text" }};'
    content = content[:last_pos] + css_import + content[last_pos:]

# Add adopt-styles import if not present
if "adopt-styles" not in content:
    first_import = re.search(r'^(import\s.+;)$', content, re.MULTILINE)
    if first_import:
        pos = first_import.end()
        content = content[:pos] + '\nimport { cssSheet } from "@styles/adopt-styles";' + content[pos:]

# Add adoptStyles call before this.render() in connectedCallback
content = re.sub(
    r'(\s+)(this\.render\(\);)',
    rf'\1this.adoptStyles(cssSheet({var_name}));\n\1\2',
    content,
    count=1
)

# Clean up empty imports: import {} from "..."  or  import { } from "..."
content = re.sub(r'^import\s*\{\s*\}\s*from\s*"[^"]+"\s*;\s*\n', '', content, flags=re.MULTILINE)

# Clean up unused theme imports — remove tokens no longer referenced outside imports
for token in ["colors", "spacing", "borderRadius", "fontSize", "sizing", "transitions", "alpha"]:
    # Check if token is used anywhere outside import lines
    non_imports = re.sub(r'^import.*$', '', content, flags=re.MULTILINE)
    if token not in non_imports:
        # Remove from named imports
        # Pattern: token surrounded by optional comma and whitespace in { ... }
        content = re.sub(rf',\s*{token}\b', '', content)
        content = re.sub(rf'\b{token}\s*,\s*', '', content)
        content = re.sub(rf'\b{token}\b\s*', '', content)

# Clean up empty imports again after token removal
content = re.sub(r'^import\s*\{\s*\}\s*from\s*"[^"]+"\s*;\s*\n', '', content, flags=re.MULTILINE)
content = re.sub(r'^import\s*\{\s*,', 'import {', content, flags=re.MULTILINE)

# Clean up multiple blank lines
content = re.sub(r'\n{3,}', '\n\n', content)

with open(ts_file, "w") as f:
    f.write(content)
print(f"  Updated: {ts_file}")
PYEOF

echo "  Done: $BASENAME"
