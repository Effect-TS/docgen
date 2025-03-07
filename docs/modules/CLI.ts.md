---
title: CLI.ts
nav_order: 2
parent: Modules
---

## CLI overview

Since v0.6.0

---

## Exports Grouped by Category

- [CLI](#cli)
  - [cli](#cli-1)

---

# CLI

## cli

**Signature**

```ts
export declare const cli: (
  args: ReadonlyArray<string>
) => Effect.Effect<
  void,
  ValidationError.ValidationError | DocgenError | PlatformError,
  Process | CommandExecutor | CliApp.Environment
>
```

Since v0.6.0
