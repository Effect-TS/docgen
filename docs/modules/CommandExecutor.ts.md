---
title: CommandExecutor.ts
nav_order: 1
parent: Modules
---

## CommandExecutor overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [layer](#layer)
  - [CommandExecutorLive](#commandexecutorlive)
- [service](#service)
  - [CommandExecutor](#commandexecutor)
  - [CommandExecutor (interface)](#commandexecutor-interface)

---

# layer

## CommandExecutorLive

**Signature**

```ts
export declare const CommandExecutorLive: Layer.Layer<never, never, CommandExecutor>
```

Added in v1.0.0

# service

## CommandExecutor

**Signature**

```ts
export declare const CommandExecutor: Context.Tag<CommandExecutor, CommandExecutor>
```

Added in v1.0.0

## CommandExecutor (interface)

Represents an entity that is capable of spawning child processes.

**Signature**

```ts
export interface CommandExecutor {
  readonly spawn: (command: string, ...args: Array<string>) => Effect.Effect<never, Error, void>
}
```

Added in v1.0.0
