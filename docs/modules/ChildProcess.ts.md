---
title: ChildProcess.ts
nav_order: 2
parent: Modules
---

## ChildProcess overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructors](#constructors)
  - [ExecutionError](#executionerror)
  - [SpawnError](#spawnerror)
- [model](#model)
  - [ChildProcess (interface)](#childprocess-interface)
  - [ExecutionError (interface)](#executionerror-interface)
  - [SpawnError (interface)](#spawnerror-interface)
- [service](#service)
  - [ChildProcess](#childprocess)
  - [ChildProcessLive](#childprocesslive)

---

# constructors

## ExecutionError

**Signature**

```ts
export declare const ExecutionError: Data.Case.Constructor<ExecutionError, '_tag'>
```

Added in v1.0.0

## SpawnError

**Signature**

```ts
export declare const SpawnError: Data.Case.Constructor<SpawnError, '_tag'>
```

Added in v1.0.0

# model

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
  spawn(command: string, executable: string): Effect.Effect<never, ExecutionError | SpawnError, void>
}
````

Added in v1.0.0

## ExecutionError (interface)

Represents an error that occurs within a child process during execution.

**Signature**

```ts
export interface ExecutionError extends Data.Case {
  readonly _tag: 'ExecutionError'
  readonly command: string
  readonly stderr: string
}
```

Added in v1.0.0

## SpawnError (interface)

Represents an error that occurs when trying to spawn a child process.

**Signature**

```ts
export interface SpawnError extends Data.Case {
  readonly _tag: 'SpawnError'
  readonly command: string
  readonly args: ReadonlyArray<string>
  readonly error: Error
}
```

Added in v1.0.0

# service

## ChildProcess

**Signature**

```ts
export declare const ChildProcess: Context.Tag<ChildProcess, ChildProcess>
```

Added in v1.0.0

## ChildProcessLive

**Signature**

```ts
export declare const ChildProcessLive: Layer.Layer<never, never, ChildProcess>
```

Added in v1.0.0
