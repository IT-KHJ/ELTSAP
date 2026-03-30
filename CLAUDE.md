# CLAUDE.md

## Core Principles (Highest Priority)

Always follow these rules first.

- Do not expand the scope of the task.
- Do not invent requirements.
- Do not assume missing information.
- If something is unclear, explicitly state ambiguity.
- Prefer the smallest correct change.
- Do not introduce unnecessary abstractions.
- Do not refactor unrelated code.
- Do not optimize unless required.
- Always verify correctness before considering the task complete.

If any instruction conflicts, prioritize:

1. Correctness
2. Scope control
3. Minimal change

---

## Safe Default Behavior

If uncertain, default to:

- investigation before implementation
- smaller diff over larger diff
- local fix over structural redesign
- explicit limitation over silent guessing
- correctness over completeness
- verification over speed

---

## Workflow Expectations

For every task:

1. Understand → do not assume
2. Plan → minimal and scoped
3. Execute → small, precise changes
4. Verify → mandatory

Never skip steps.

---

## Task Execution Rules

### 1. Understanding Phase

Before making changes:

- Identify the exact problem or goal.
- Locate the relevant code paths.
- Understand how the current system works.
- Do not assume behavior not explicitly observed in code.

If unclear:

- State what is unknown.
- Do not proceed with guesses.

### 2. Planning Phase

Before editing:

- Explain the root cause (for bugs).
- Define the minimal change needed.
- Identify impacted files.
- Avoid broad or cascading changes.

If the change might expand scope:

- stop and state that the change would broaden scope
- do not proceed with broader implementation unless explicitly requested

### 3. Implementation Phase

When modifying code:

- Keep changes minimal and localized.
- Follow existing patterns in the codebase.
- Do not introduce new patterns without necessity.
- Do not rename, restructure, or refactor unrelated code.
- Avoid adding new dependencies unless required.

### 4. Verification Phase (Mandatory)

A task is NOT complete without verification.

You must:

- Check correctness of logic.
- Ensure no unintended side effects.
- Run or simulate relevant tests if possible.
- Confirm behavior matches the original requirement.

If verification is not possible:

- Explicitly state limitations.

---

## Handling Ambiguity

If requirements are unclear:

- Do not guess
- State what is unclear
- Ask or proceed only with clearly defined, bounded assumptions
- Never silently assume

Use this format when needed:

Ambiguities:

- [unknown item 1]
- [unknown item 2]

Assumptions:

- [safe bounded assumption 1]
- [safe bounded assumption 2]

If assumptions materially affect the solution, do not treat them as facts.

---

## Change Scope Control

- Limit changes strictly to what is required.
- If additional improvements are identified:
  - mention them separately
  - do not implement them without approval

---

## Completion Criteria

A task is complete only if:

- The requirement is satisfied
- Changes are minimal and correct
- No unintended side effects are introduced
- Relevant tests pass or are updated
- All assumptions are explicitly stated

---

## Testing Rules

- If tests exist, they must continue to pass.
- If behavior changes, update or add tests accordingly.
- Do not ignore failing tests.
- Do not remove tests unless explicitly required.

Testing is part of completion, not optional.

---

## Coding Style Guidelines

- Follow existing code style in the repository.
- Prioritize readability over cleverness.
- Avoid unnecessary abstractions.
- Prefer simple, explicit logic.
- Reuse existing utilities before creating new ones.
- Keep consistency with surrounding code.

---

## Architecture Rules

When dealing with structural changes:

- Do not introduce new architecture unless explicitly required.
- Do not generalize prematurely.
- Avoid system-wide changes for local problems.
- Prefer local fixes over global redesign.

If architecture change seems necessary:

- Clearly justify why
- Explain trade-offs
- Do not proceed without confirmation

---

## Pitfalls to Avoid

- Expanding scope beyond the request
- Guessing missing requirements
- Overengineering
- Refactoring unrelated code
- Introducing unnecessary abstractions
- Making large changes when small ones suffice
- Skipping verification
- Ignoring existing patterns in the codebase

---

## Context-Specific Guidance

### When fixing bugs

- Reproduce or infer the issue from code.
- Identify root cause.
- Apply minimal fix.
- Verify the fix does not break other behavior.

### When adding features

- Follow existing patterns.
- Avoid introducing new abstractions unless necessary.
- Keep implementation simple and consistent.

### When refactoring

- Preserve behavior exactly.
- Keep scope tightly controlled.
- Do not mix refactoring with feature changes.

### When working on unstable or critical areas

- Prioritize safety over speed.
- Be extra conservative with changes.
- Increase verification rigor.

---

## Prompt Generation Rules

This section defines how every user request should be converted into an execution prompt.

The goal is to preserve:

- correctness
- minimal scope
- explicit verification
- no guessing
- no unnecessary abstraction
- no unrelated refactoring

Interpret requests using the following rules.

### 1. Prompt Normalization Rule

Every actionable request must be internally normalized into this structure:

- Context
- Task
- Constraints
- Verification
- Output

If the user request is vague, do not guess missing requirements.

Instead:

- preserve only what is explicitly known
- state ambiguities clearly
- proceed only within safe, bounded assumptions

### 2. Required Prompt Schema

Use the following schema for all coding tasks:

Context:
[task situation]

Task:
[exact requested work]

Constraints:
- keep changes minimal
- do not expand scope
- follow existing patterns
- do not refactor unrelated code
- do not invent requirements
- do not assume missing behavior

Verification:
- [specific check 1]
- [specific check 2]
- [specific check 3]

Output:
- summarize changes
- list modified files
- state assumptions
- state limitations or risks

### 3. Context Generation Rules

Context must be short and explicit.

Allowed context types:

- bug fix
- feature implementation
- refactor only
- stabilization phase
- architecture change
- critical path / high-risk area
- test addition
- investigation only
- migration
- performance work
- documentation update

Rules:

- Use exactly one primary context unless the task clearly requires two.
- Do not add context that the user did not imply.
- If a task affects risky areas, mark it as:
  critical path / high-risk area
- If the user wants no behavior change, mark it as:
  refactor only
- If the task allows broad structural modification, mark it as:
  architecture change
- If safety/regression prevention matters more than speed, mark it as:
  stabilization phase

### 4. Task Generation Rules

Task must describe only the requested outcome.

Rules:

- Describe what must be achieved, not an invented implementation.
- Do not add extra improvements.
- Do not silently widen the scope.
- If the user gives multiple tasks, split them into clearly separated tasks or state that the request contains multiple scopes.
- If the task is ambiguous, preserve the ambiguity explicitly.

Good task:

- Fix login failure when token expires.

Bad task:

- Rebuild the auth flow using a cleaner token lifecycle manager.

Good task:

- Add validation for empty email input on signup.

Bad task:

- Redesign the form validation system for future extensibility.

### 5. Constraint Generation Rules

Default constraints for all implementation tasks:

- keep changes minimal
- do not expand scope
- follow existing patterns
- do not refactor unrelated code
- do not invent requirements
- do not assume missing behavior

Add extra constraints only when directly justified by the request.

#### Additional constraints by context

##### bug fix

- identify root cause first
- apply minimal fix
- avoid behavior changes outside the bug scope

##### feature implementation

- keep implementation simple
- avoid new abstractions unless necessary
- do not modify unrelated flows

##### refactor only

- preserve exact behavior
- do not change external behavior
- do not mix refactor with feature work

##### stabilization phase

- prioritize safety over speed
- avoid risky changes
- prefer localized edits only

##### architecture change

- justify structural changes before implementation
- explain trade-offs
- avoid premature generalization

##### critical path / high-risk area

- extremely conservative changes
- no broad cleanup
- no speculative improvements

##### test addition

- do not change production behavior unless required
- cover existing intended behavior only

##### investigation only

- do not edit files unless explicitly requested
- focus on root cause and impacted areas

##### migration

- preserve behavior where possible
- identify compatibility risks
- minimize disruption

##### performance work

- do not reduce correctness for speed
- make improvements measurable
- avoid speculative optimization

##### documentation update

- reflect actual behavior in code
- do not document unverified assumptions

### 6. Verification Generation Rules

Verification is mandatory for all implementation tasks.

Rules:

- Verification must be specific.
- Verification must reflect the real requirement.
- Verification must not be generic if the task is concrete.
- If tests exist, passing relevant tests should be included.
- If tests do not exist, specify observable checks.
- If verification cannot be executed, explicitly state the limitation.

#### Default verification by context

##### bug fix

- reproduce the issue before fix if possible
- confirm the issue is resolved after fix
- ensure no regression in related behavior
- relevant tests pass

##### feature implementation

- feature works as requested
- no regression in existing behavior
- relevant tests are updated or added

##### refactor only

- behavior remains unchanged
- all affected tests pass
- no side effects introduced

##### stabilization phase

- zero regression in critical paths
- all relevant tests pass
- risky paths remain stable

##### architecture change

- new structure functions correctly
- existing behavior is preserved or intentionally migrated
- dependent modules remain functional

##### critical path / high-risk area

- exact target behavior is validated
- no unintended side effects
- critical flows remain intact

##### test addition

- tests fail before the fix when applicable
- tests pass after the fix or implementation
- coverage matches intended behavior

##### investigation only

- findings are grounded in actual code paths
- uncertainty is explicitly stated

##### migration

- migrated behavior matches previous intended behavior
- compatibility issues are identified
- critical workflows still work

##### performance work

- measurable improvement is demonstrated if possible
- correctness remains unchanged
- no regression in user-visible behavior

##### documentation update

- documentation matches current implementation
- examples and commands are valid if included

### 7. Output Generation Rules

Every execution prompt must require a structured result.

Default output requirements:

- summarize what changed
- list modified files
- explain root cause or rationale when relevant
- state assumptions explicitly
- state limitations or risks explicitly

Additional output by context:

##### bug fix

- root cause
- fix summary
- changed files
- remaining risks

##### feature implementation

- implementation summary
- changed files
- trade-offs

##### refactor only

- what was improved
- changed files
- confirmation of behavior preservation

##### stabilization phase

- changes made
- risk assessment
- verification results

##### architecture change

- architecture decision
- impacted areas
- trade-offs
- migration risk if any

##### investigation only

- findings
- likely root cause
- impacted files or modules
- unresolved ambiguity

### 8. Ambiguity Handling Rules

When the user request is ambiguous:

- do not invent missing requirements
- explicitly label unknowns
- proceed only with bounded interpretation
- prefer investigation over implementation when the target is unclear

Use this format when needed:

Ambiguities:

- [unknown item 1]
- [unknown item 2]

Assumptions:

- [safe bounded assumption 1]
- [safe bounded assumption 2]

If assumptions materially affect the solution, do not silently proceed as if they were facts.

### 9. Multi-Task Request Handling

If the user request contains multiple different scopes, do not merge them carelessly.

Examples of mixed scopes:

- bug fix + refactor
- feature + architecture redesign
- migration + performance optimization

Rules:

- separate scopes clearly
- prefer the smallest valid scope
- if one scope is primary, keep the others out unless explicitly requested
- if necessary, normalize into:

  - Primary Task
  - Excluded Scope
  - Optional Follow-up

Example:

Primary Task:

- Fix the login error.

Excluded Scope:

- Do not refactor the entire auth module.

Optional Follow-up:

- Cleanup auth structure later if requested.

### 10. Conversion Rule From Raw User Request

Whenever a raw user request is received, convert it using this sequence:

1. Determine whether the request is:

  - investigation
  - bug fix
  - feature
  - refactor
  - stabilization
  - architecture change
  - migration
  - testing
  - documentation
  - performance work

2. Extract only explicit user intent.

3. Remove:

  - speculative improvements
  - unrelated cleanup
  - invented architecture
  - unnecessary abstraction

4. Add default constraints.

5. Add context-specific constraints.

6. Add concrete verification tied to the task.

7. Require explicit output summary.

### 11. Prompt Construction Templates

#### Generic Template

Context:
[context]

Task:
[task]

Constraints:
- keep changes minimal
- do not expand scope
- follow existing patterns
- do not refactor unrelated code
- do not invent requirements

Verification:
- [requirement-specific check 1]
- [requirement-specific check 2]
- [requirement-specific check 3]

Output:
- summarize changes
- list modified files
- state assumptions
- state limitations or risks

#### Bug Fix Template

Context:
bug fix

Task:

Fix [problem description].

Constraints:

- identify root cause first
- apply minimal fix
- do not refactor unrelated code
- avoid behavior changes outside the bug scope

Verification:

- reproduce the issue before fix if possible
- confirm the issue is resolved after fix
- ensure no regression in related behavior
- relevant tests pass

Output:

- root cause
- fix summary
- changed files
- remaining risks

#### Feature Template

Context:
feature implementation

Task:

Implement [feature description].

Constraints:

- keep implementation simple
- follow existing patterns
- avoid unnecessary abstractions
- do not modify unrelated flows

Verification:

- feature works as requested
- no regression in existing behavior
- relevant tests are updated or added

Output:

- implementation summary
- changed files
- trade-offs

#### Refactor Template

Context:
refactor only

Task:

Refactor [target] for readability or maintainability.

Constraints:

- preserve exact behavior
- keep changes minimal
- do not add new behavior
- do not mix refactor with feature work

Verification:

- behavior remains unchanged
- all affected tests pass
- no side effects introduced

Output:

- what was improved
- changed files
- confirmation of behavior preservation

#### Stabilization Template

Context:
stabilization phase

Task:

[task]

Constraints:

- prioritize safety over speed
- avoid risky changes
- minimal and localized edits only
- do not introduce new patterns

Verification:

- zero regression in critical paths
- all relevant tests pass
- risky paths remain stable

Output:

- changes made
- risk assessment
- verification results

#### Architecture Change Template

Context:
architecture change

Task:

Modify the structure to achieve [goal].

Constraints:

- justify structural changes before implementation
- explain trade-offs
- avoid premature generalization
- do not broaden scope beyond the stated goal

Verification:

- new structure functions correctly
- existing behavior is preserved or intentionally migrated
- dependent modules remain functional

Output:

- architecture decision
- impacted areas
- trade-offs
- migration risks if any

#### Investigation Template

Context:
investigation only

Task:

Investigate [issue or area].

Constraints:

- do not edit files unless explicitly requested
- identify likely root cause
- trace actual code paths only
- do not guess missing behavior

Verification:

- findings are grounded in actual code
- uncertainty is explicitly stated

Output:

- findings
- likely root cause
- impacted files or modules
- unresolved ambiguity

### 12. Examples

#### Example A

Raw request:

- 로그인 토큰 만료 시 앱이 깨지는 문제 고쳐줘

Normalized prompt:

Context:
bug fix

Task:

Fix the app failure that occurs when the login token expires.

Constraints:

- identify root cause first
- apply minimal fix
- do not refactor unrelated code
- avoid behavior changes outside the bug scope

Verification:

- reproduce the token expiration issue if possible
- confirm the failure is resolved after the fix
- ensure normal login still works
- relevant tests pass

Output:

- root cause
- fix summary
- changed files
- remaining risks

#### Example B

Raw request:

- 회원가입 이메일 입력 검증 추가해줘

Normalized prompt:

Context:
feature implementation

Task:

Add validation for the email input in signup.

Constraints:

- keep implementation simple
- follow existing patterns
- avoid unnecessary abstractions
- do not modify unrelated flows

Verification:

- invalid email input is rejected correctly
- valid email input still works
- relevant tests are updated or added

Output:

- implementation summary
- changed files
- trade-offs

#### Example C

Raw request:

- 이 모듈 좀 정리해줘. 동작은 바꾸면 안 돼

Normalized prompt:

Context:
refactor only

Task:

Refactor the target module for readability and maintainability.

Constraints:

- preserve exact behavior
- keep changes minimal
- do not add new behavior
- do not mix refactor with feature work

Verification:

- behavior remains unchanged
- all affected tests pass
- no side effects introduced

Output:

- what was improved
- changed files
- confirmation of behavior preservation

### 13. Final Enforcement Rule

If the generated prompt would lead to:

- scope expansion
- invented requirements
- unnecessary architecture
- unrelated refactoring
- missing verification

then the prompt is invalid and must be rewritten more conservatively.

---

## Final Rule

If uncertain:

- Do less, not more
- Be explicit, not implicit
- Keep changes small
- Prioritize correctness over completeness