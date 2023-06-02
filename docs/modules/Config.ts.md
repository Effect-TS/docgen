---
title: Config.ts
nav_order: 3
parent: Modules
---

## Config overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructors](#constructors)
  - [ConfigError](#configerror)
- [model](#model)
  - [Config (interface)](#config-interface)
  - [ConfigError (interface)](#configerror-interface)
- [service](#service)
  - [Config](#config)
  - [ConfigLive](#configlive)

---

# constructors

## ConfigError

**Signature**

```ts
export declare const ConfigError: Data.Case.Constructor<ConfigError, '_tag'>
```

Added in v1.0.0

# model

## Config (interface)

**Signature**

```ts
export interface Config {
  readonly projectName: string
  readonly projectHomepage: string
  readonly srcDir: string
  readonly outDir: string
  readonly theme: string
  readonly enableSearch: boolean
  readonly enforceDescriptions: boolean
  readonly enforceExamples: boolean
  readonly enforceVersion: boolean
  readonly exclude: ReadonlyArray<string>
  readonly parseCompilerOptions: Record<string, unknown>
  readonly examplesCompilerOptions: Record<string, unknown>
}
```

Added in v1.0.0

## ConfigError (interface)

**Signature**

```ts
export interface ConfigError extends Data.Case {
  readonly _tag: 'ConfigError'
  readonly message: string
}
```

Added in v1.0.0

# service

## Config

**Signature**

```ts
export declare const Config: Context.Tag<Config, Config>
```

Added in v1.0.0

## ConfigLive

**Signature**

```ts
export declare const ConfigLive: Layer.Layer<unknown, unknown, Config>
```

Added in v1.0.0
