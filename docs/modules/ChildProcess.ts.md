---
title: ChildProcess.ts
nav_order: 2
parent: Modules
---

## ChildProcess overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [service](#service)
  - [ChildProcess](#childprocess)
  - [ChildProcess (interface)](#childprocess-interface)
  - [ChildProcessLive](#childprocesslive)

---

# service

## ChildProcess

**Signature**

```ts
export declare const ChildProcess: Context.Tag<ChildProcess, ChildProcess>
```

Added in v1.0.0

## ChildProcess (interface)

Represents an entity that is capable of spawning child processes.

**Signature**

````ts
export interface ChildProcess {
  /**
   * Executes a command like:
   *
   * ```sh
   * ts-node docs/examples/index.ts
   * ```
   *
   * where `command = ts-node` and `executable = docs/examples/index.ts`
   */
  spawn(command: string, executable: string): Effect.Effect<never, Error, void>
}
````

Added in v1.0.0

## ChildProcessLive

**Signature**

```ts
export declare const ChildProcessLive: Layer.Layer<never, never, ChildProcess>
```

Added in v1.0.0
