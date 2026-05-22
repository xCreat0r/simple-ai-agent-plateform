# AGENTS.md

This file defines global rules for AI coding agents working in this repository.

It prioritizes:

- correctness
- simplicity
- maintainability
- minimal diffs

--------------------------------------------------

# 1. Core Principle

Prefer:

simple > clever
explicit > implicit
existing code > new patterns

Do not over-engineer.

If multiple solutions exist, choose the simplest one that works.

--------------------------------------------------

# 2. Workflow (MANDATORY)

For every task:

1. Understand the requirement
2. Inspect relevant code and docs
3. Identify minimal change scope
4. Write a short plan before coding
5. Implement changes
6. Validate (tests/build/manual check)
7. Summarize changes

Never skip step 4 (planning).

--------------------------------------------------

# 3. Change Scope Rules

Only modify files necessary for the task.

Strictly avoid:

- unrelated refactoring
- large-scale renaming
- architecture changes without request
- formatting entire codebase
- deleting unused code unless asked

Keep diffs minimal and focused.

--------------------------------------------------

# 4. Code Quality Rules

Always prefer:

- clear naming
- small functions
- single responsibility
- predictable behavior
- reusable but not over-abstracted code

Avoid:

- magic values
- deep nesting
- unnecessary abstraction
- duplicated logic without reason
- hidden side effects

If unsure, choose readability over abstraction.

--------------------------------------------------

# 5. Architecture Rule

Respect existing structure.

Do NOT introduce new architecture patterns
unless explicitly requested.

Follow existing project conventions first.

--------------------------------------------------

# 6. Dependency Rule

Before adding a dependency:

Ask:

- Can this be done with existing code?
- Is the dependency necessary?
- Is it widely used and maintained?

Prefer zero dependencies when possible.

--------------------------------------------------

# 7. Testing Rule

When changing logic:

- Ensure existing tests still pass
- Add tests for new behavior if needed
- Add regression tests for bug fixes

Do not skip validation.

--------------------------------------------------

# 8. Validation Checklist

Before finishing:

- [ ] Code compiles / runs
- [ ] Tests pass
- [ ] No obvious type errors
- [ ] No unused imports or dead code introduced
- [ ] Behavior matches requirement

--------------------------------------------------

# 9. Documentation Rule

Update documentation if behavior changes:

- README
- API docs
- comments (only when necessary)
- specs

Keep docs minimal but accurate.

--------------------------------------------------

# 10. Security Rule

Never:

- expose secrets
- log credentials or tokens
- trust external input without validation

Always validate inputs at boundaries.

--------------------------------------------------

# 11. Performance Rule

Avoid premature optimization.

But prevent:

- unnecessary repeated computation
- obvious N+1 patterns
- redundant API calls

Optimize only when needed.

--------------------------------------------------

# 12. Logging Rule

Logs should help debugging.

Never log:

- passwords
- tokens
- sensitive user data

Prefer structured logs when applicable.

--------------------------------------------------

# 13. Uncertainty Rule

If requirements are unclear:

- do NOT guess
- explicitly state assumptions
- request clarification

--------------------------------------------------

# 14. Git Discipline (Optional but recommended)

Prefer:

- small atomic commits
- one logical change per commit
- meaningful commit messages

Avoid mixing unrelated changes.

--------------------------------------------------

# 15. Definition of Done

A task is complete only when:

✓ implementation finished  
✓ validation performed  
✓ tests pass  
✓ changes are minimal and focused  
✓ summary provided  