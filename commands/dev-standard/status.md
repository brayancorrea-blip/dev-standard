---
name: dev-standard:status
description: Show current dev-standard workflow status and SPARC phase progress
---

# /dev-standard:status

Show the current status of the dev-standard workflow.

## What it shows

1. **Project type**: Detected language and framework
2. **SPARC phase**: Current phase for active features
3. **Quality gates**: Which gates are active (warn/block/off)
4. **Document chain**: Which docs exist for each feature
5. **Memory stats**: Ruflo memory entries and patterns
6. **Session metrics**: Edits, commands, tasks in current session

## Usage

```
/dev-standard:status
```

## Implementation

Read dev-standard.json for config, scan docs/ directories for document chain completeness, query ruflo memory for pattern count, read session metrics from .claude-flow/sessions/current.json.
