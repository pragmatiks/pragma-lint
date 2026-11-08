# pragma-lint

Unified lint packages for Pragmatiks engineering principles.

This repository is library-only. It contains the Python package `pragmatiks-lint`, the npm package `@pragmatiks/lint`, and one shared semgrep ruleset in `rules/`.

The CLI surface belongs in `pragma-cli`.

## Packages

- `python/` exports `run_check`, `Finding`, and `list_rules` from `pragmatiks_lint`, and ships two pre-commit hook targets: the strict no-comments check `pragmatiks_lint.comments` (`python -m pragmatiks_lint.comments <files>`) and the dependency source check `pragmatiks_lint.sources` (`python -m pragmatiks_lint.sources <manifests>`), which rejects committed paths that leave the repository and dependencies that do not resolve from a registry.
- `js/` exports `pragmatiksConfig`, eslint option constants, `PRAGMATIKS_LINT_FILES`, and semgrep rule path helpers from `@pragmatiks/lint`, and `pragmatiksNextConfig` for Next.js apps from `@pragmatiks/lint/eslint-config/next`.

## Development

Use the top-level mise tasks:

```bash
mise run all:install
mise run python:install
mise run python:test
mise run js:install
mise run js:test
mise run all:check
mise run all:build
```

`mise run all:install` installs both packages' dependencies and the repository's pre-commit hook.

`rules/*.yml` is the source of truth. Build tasks vendor those files into each package artifact and the vendored copies are ignored by git.

## Rejected rule candidates

Patterns reviewers raised by hand that the ruleset does not enforce, and why. Reviewers still flag them by judgment.

From the PRA-703 reviews (PRA-733):

- **Duplicate string literals across or within modules**: across modules needs whole-program analysis; within one module a literal count is noisy for log markers and keys, and no ruff rule covers it.
- **Bare `future.exception()` / `future.result()`**: every occurrence is deliberate, consuming the error so asyncio never reports it as unretrieved.
- **Literal index into `str.split(...)`**: `split(...)[0]` and `[-1]` are the idiomatic form; unpacking is not clearer.
- **Nested multi-argument calls and inline constructors with three or more keyword arguments**: a readability judgment whose thresholds fire on ordinary code.
- **`return` inside `with` followed by a duplicate `return`**: a one-off shape with no occurrences to justify a rule.
- **`None` passed positionally to an `X | None` parameter**: needs the callee's signature types, which semgrep cannot see and ty does not check.
- **Comprehension with two or more `for` clauses**: semgrep matches comprehension clauses exactly, so a rule needs one pattern per clause count, `if` position and `async` combination and still misses longer forms.
- **Linter for the e2e TypeScript suite**: not a pattern rule; adopting `@pragmatiks/lint` there is tracked as its own issue.
