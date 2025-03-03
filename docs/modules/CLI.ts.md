---
title: CLI.ts
nav_order: 1
parent: Modules
---

## CLI overview

Since v0.6.0

---

<h2 class="text-delta">Table of contents</h2>

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
