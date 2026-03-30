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
