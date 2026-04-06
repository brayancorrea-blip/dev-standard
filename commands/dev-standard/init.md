---
name: dev-standard:init
description: Initialize dev-standard workflow in current repository
---

# /dev-standard:init

Initialize the dev-standard professional development workflow in the current repository.

## What it does

1. Detects project type (Java/Maven, Node, Go, Python, Rust, .NET)
2. Configures quality gates adapted to the project
3. Sets up SPARC phase enforcement via hooks
4. Initializes ruflo memory for cross-session learning
5. Creates document chain directories (docs/prd/, docs/architecture/, docs/review/)

## Usage

```
/dev-standard:init
```

## After initialization

- Every feature request triggers SPARC phase checking
- Pre-edit hooks enforce TDD (test before source)
- Session memory persists learnings across sessions
- Team knowledge accumulates in docs/.dev-standard/
