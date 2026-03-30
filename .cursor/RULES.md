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
