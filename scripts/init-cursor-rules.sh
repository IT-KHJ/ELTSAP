#!/usr/bin/env bash
set -eu

PROJECT_ROOT="${1:-.}"

CURSOR_DIR="$PROJECT_ROOT/.cursor"
RULES_DIR="$CURSOR_DIR/rules"
LIBRARY_DIR="$CURSOR_DIR/rules-library"
PRESETS_DIR="$CURSOR_DIR/rule-presets"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"
USE_RULES_SCRIPT="$SCRIPTS_DIR/use-rules.sh"
RULES_GUIDE="$CURSOR_DIR/RULES.md"
SETUP_README="$PROJECT_ROOT/README.cursor-rules-setup.md"
GITIGNORE_FILE="$PROJECT_ROOT/.gitignore"

log() {
  printf '%s\n' "$1"
}

warn() {
  printf 'Warning: %s\n' "$1" >&2
}

create_dir() {
  dir_path="$1"
  if [ ! -d "$dir_path" ]; then
    mkdir -p "$dir_path"
    log "Created directory: $dir_path"
  else
    log "Directory already exists: $dir_path"
  fi
}

write_file_if_missing() {
  target_path="$1"
  tmp_path="$(mktemp)"

  cat > "$tmp_path"

  if [ -e "$target_path" ]; then
    warn "Skipped existing file: $target_path"
    rm -f "$tmp_path"
    return 0
  fi

  mkdir -p "$(dirname "$target_path")"
  mv "$tmp_path" "$target_path"
  log "Created file: $target_path"
}

append_line_if_missing() {
  target_file="$1"
  line_text="$2"

  touch "$target_file"

  if grep -F -x -q "$line_text" "$target_file"; then
    log "Already present in $(basename "$target_file"): $line_text"
  else
    printf '%s\n' "$line_text" >> "$target_file"
    log "Appended to $(basename "$target_file"): $line_text"
  fi
}

create_dir "$RULES_DIR"
create_dir "$LIBRARY_DIR"
create_dir "$PRESETS_DIR"
create_dir "$SCRIPTS_DIR"

write_file_if_missing "$PRESETS_DIR/initial.txt" <<'EOF'
core.mdc
EOF

write_file_if_missing "$PRESETS_DIR/initial_strict.txt" <<'EOF'
core.mdc
pitfalls.mdc
EOF

write_file_if_missing "$PRESETS_DIR/mid.txt" <<'EOF'
core.mdc
workflow.mdc
pitfalls.mdc
EOF

write_file_if_missing "$PRESETS_DIR/mid_style.txt" <<'EOF'
core.mdc
workflow.mdc
pitfalls.mdc
coding-style.mdc
EOF

write_file_if_missing "$PRESETS_DIR/stabilization.txt" <<'EOF'
core.mdc
workflow.mdc
pitfalls.mdc
coding-style.mdc
testing.mdc
EOF

write_file_if_missing "$PRESETS_DIR/architecture_change.txt" <<'EOF'
core.mdc
workflow.mdc
pitfalls.mdc
architecture.mdc
EOF

write_file_if_missing "$RULES_GUIDE" <<'EOF'
# Cursor Rules Operation Guide

## Source of truth
Edit original rule files only in:

.cursor/rules-library/

## Active rules
Only `.mdc` files inside:

.cursor/rules/

are active in Cursor.

## Presets
- initial: early exploration
- initial_strict: early stage with stronger guardrails
- mid: feature growth with scope control
- mid_style: mid stage with style consistency
- stabilization: stability, consistency, regression prevention
- architecture_change: temporary preset for structural work

## How to switch
Use:

./scripts/use-rules.sh <preset-name>

Examples:

./scripts/use-rules.sh initial
./scripts/use-rules.sh mid
./scripts/use-rules.sh stabilization
./scripts/use-rules.sh architecture_change

## Recommended workflow
1. Put original `.mdc` files into `.cursor/rules-library/`
2. Apply a preset with `./scripts/use-rules.sh <preset-name>`
3. Only `.cursor/rules/` should contain active rules
4. Do not manually edit copied files in `.cursor/rules/`
EOF

write_file_if_missing "$USE_RULES_SCRIPT" <<'EOF'
#!/usr/bin/env bash
set -eu

PRESET_NAME="${1:-}"

if [ -z "$PRESET_NAME" ]; then
  echo "Usage: ./scripts/use-rules.sh <preset-name>"
  echo ""
  echo "Available presets:"
  echo "  initial"
  echo "  initial_strict"
  echo "  mid"
  echo "  mid_style"
  echo "  stabilization"
  echo "  architecture_change"
  exit 1
fi

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"

RULES_DIR="$PROJECT_ROOT/.cursor/rules"
LIBRARY_DIR="$PROJECT_ROOT/.cursor/rules-library"
PRESET_FILE="$PROJECT_ROOT/.cursor/rule-presets/${PRESET_NAME}.txt"
ACTIVE_PRESET_FILE="$PROJECT_ROOT/.cursor/.active-rule-preset"

if [ ! -f "$PRESET_FILE" ]; then
  echo "Error: preset file not found: $PRESET_FILE" >&2
  exit 1
fi

if [ ! -d "$LIBRARY_DIR" ]; then
  echo "Error: rules library directory not found: $LIBRARY_DIR" >&2
  exit 1
fi

mkdir -p "$RULES_DIR"

find "$RULES_DIR" -maxdepth 1 -type f -name "*.mdc" -delete

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

grep -v '^[[:space:]]*$' "$PRESET_FILE" | grep -v '^[[:space:]]*#' > "$TMP_FILE"

while IFS= read -r rule_file; do
  SRC="$LIBRARY_DIR/$rule_file"
  DST="$RULES_DIR/$rule_file"

  if [ ! -f "$SRC" ]; then
    echo "Error: rule not found in library: $rule_file" >&2
    exit 1
  fi

  cp "$SRC" "$DST"
done < "$TMP_FILE"

echo "$PRESET_NAME" > "$ACTIVE_PRESET_FILE"

echo "Applied preset: $PRESET_NAME"
echo "Active rules:"
find "$RULES_DIR" -maxdepth 1 -type f -name "*.mdc" -exec basename {} \; | sort
EOF

write_file_if_missing "$SETUP_README" <<'EOF'
# Cursor Rules Setup

## Created structure
- .cursor/rules/                  : active rules only
- .cursor/rules-library/          : original rule files
- .cursor/rule-presets/           : preset definitions
- .cursor/RULES.md                : usage guide
- scripts/use-rules.sh            : preset switch script

## Next step
Copy your original `.mdc` files into:

.cursor/rules-library/

Expected files:
- core.mdc
- workflow.mdc
- coding-style.mdc
- architecture.mdc
- testing.mdc
- pitfalls.mdc

## Examples
./scripts/use-rules.sh initial
./scripts/use-rules.sh mid
./scripts/use-rules.sh stabilization
./scripts/use-rules.sh architecture_change
EOF

if [ -f "$USE_RULES_SCRIPT" ]; then
  chmod +x "$USE_RULES_SCRIPT"
  log "Ensured executable: $USE_RULES_SCRIPT"
fi

append_line_if_missing "$GITIGNORE_FILE" ".cursor/rules/*.mdc"
append_line_if_missing "$GITIGNORE_FILE" ".cursor/.active-rule-preset"

log ""
log "Done."
log ""
log "Next steps:"
log "1. Put your original .mdc files into: $LIBRARY_DIR"
log "2. Run: ./scripts/use-rules.sh initial"
log ""
log "Notes:"
log "- Existing files were not overwritten."
log "- .gitignore was updated with append-only behavior."