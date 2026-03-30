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
