---
title: Process.ts
nav_order: 9
parent: Modules
---

## Process overview

Since v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [layer](#layer)
  - [layer](#layer-1)
- [service](#service)
  - [Process (class)](#process-class)
  - [ProcessShape (interface)](#processshape-interface)

---

# layer

## layer

**Signature**

```ts
export declare const layer: Layer.Layer<Process, never, never>
```

Since v1.0.0

# service

## Process (class)

**Signature**

```ts
export declare class Process
```

Since v1.0.0

## ProcessShape (interface)

Represents a handle to the currently executing process.

**Signature**

```ts
export interface ProcessShape {
  readonly cwd: Effect.Effect<string>
  readonly platform: Effect.Effect<string>
  readonly argv: Effect.Effect<Array<string>>
}
```

Since v1.0.0
