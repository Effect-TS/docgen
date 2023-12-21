---
title: Process.ts
nav_order: 10
parent: Modules
---

## Process overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [layer](#layer)
  - [layer](#layer-1)
- [service](#service)
  - [Process](#process)
  - [Process (interface)](#process-interface)

---

# layer

## layer

**Signature**

```ts
export declare const layer: Layer.Layer<never, never, Process>
```

Added in v1.0.0

# service

## Process

**Signature**

```ts
export declare const Process: Context.Tag<Process, Process>
```

Added in v1.0.0

## Process (interface)

Represents a handle to the currently executing process.

**Signature**

```ts
export interface Process {
  readonly cwd: Effect.Effect<never, never, string>
  readonly platform: Effect.Effect<never, never, string>
  readonly argv: Effect.Effect<never, never, Array<string>>
}
```

Added in v1.0.0
