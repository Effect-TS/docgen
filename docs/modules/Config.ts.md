---
title: Config.ts
nav_order: 2
parent: Modules
---

## Config overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [layer](#layer)
  - [ConfigLive](#configlive)
- [service](#service)
  - [Config](#config)
  - [Config (interface)](#config-interface)
  - [ConfigSchema](#configschema)

---

# layer

## ConfigLive

**Signature**

```ts
export declare const ConfigLive: Layer.Layer<FileSystem.FileSystem | Path.Path | Process.Process, Error, Config>
```

Added in v1.0.0

# service

## Config

**Signature**

```ts
export declare const Config: Context.Tag<Config, Config>
```

Added in v1.0.0

## Config (interface)

**Signature**

```ts
export interface Config {
  readonly projectName: string
  readonly projectHomepage: string
  readonly docsOutDir: string
  readonly examplesOutFile: string
  readonly theme: string
  readonly enableSearch: boolean
  readonly enforceDescriptions: boolean
  readonly enforceExamples: boolean
  readonly enforceVersion: boolean
  readonly exclude: ReadonlyArray<string>
  readonly tsConfig: string
}
```

Added in v1.0.0

## ConfigSchema

**Signature**

```ts
export declare const ConfigSchema: Schema.Schema<
  {
    readonly $schema?: string | undefined
    readonly projectHomepage?: string | undefined
    readonly docsOutDir?: string | undefined
    readonly examplesOutFile?: string | undefined
    readonly theme?: string | undefined
    readonly enableSearch?: boolean | undefined
    readonly enforceDescriptions?: boolean | undefined
    readonly exclude?: readonly string[] | undefined
    readonly enforceExamples?: boolean | undefined
    readonly enforceVersion?: boolean | undefined
    readonly tsConfig?: string | undefined
  },
  {
    readonly $schema?: string | undefined
    readonly projectHomepage?: string | undefined
    readonly docsOutDir?: string | undefined
    readonly examplesOutFile?: string | undefined
    readonly theme?: string | undefined
    readonly enableSearch?: boolean | undefined
    readonly enforceDescriptions?: boolean | undefined
    readonly exclude?: readonly string[] | undefined
    readonly enforceExamples?: boolean | undefined
    readonly enforceVersion?: boolean | undefined
    readonly tsConfig?: string | undefined
  }
>
```

Added in v1.0.0
