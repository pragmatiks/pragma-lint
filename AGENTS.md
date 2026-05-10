# AGENTS.md

## Project

**pragma-lint**: unified mono-repo for Pragmatiks lint libraries.

## Architecture

```
pragma-lint/
├── rules/      # shared semgrep source of truth
├── python/     # pragmatiks-lint Python library package
└── js/         # @pragmatiks/lint npm library package
```

## Constraints

- Library-only: no Python `[project.scripts]` entry and no npm `bin` field.
- Build tasks vendor `rules/*.yml` into package-local ignored directories.
- Do not push remotes or publish packages from this repository without explicit authorization.

## Development

Use Taskfile commands:

| Command | Purpose |
|---------|---------|
| `task python:install` | Install Python dependencies |
| `task python:check` | Ruff and mypy |
| `task python:test` | Python semgrep smoke tests |
| `task python:build` | Build wheel and sdist |
| `task js:install` | Install JS dependencies |
| `task js:check` | ESLint and TypeScript |
| `task js:test` | Vitest integration tests |
| `task js:build` | Build npm dist |
| `task all:check` | Run all checks |

## Engineering Principles
