---
title: Config.ts
nav_order: 3
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
export declare const ConfigLive: Layer.Layer<Process.Process | Path.Path | FileSystem.FileSystem, Error, Config>
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

## ConfigSchema

**Signature**

```ts
export declare const ConfigSchema: Schema.Schema<
  {
    readonly $schema?: string | undefined
    readonly projectHomepage?: string | undefined
    readonly srcDir?: string | undefined
    readonly outDir?: string | undefined
    readonly theme?: string | undefined
    readonly enableSearch?: boolean | undefined
    readonly enforceDescriptions?: boolean | undefined
    readonly enforceExamples?: boolean | undefined
    readonly enforceVersion?: boolean | undefined
    readonly exclude?: readonly string[] | undefined
    readonly parseCompilerOptions?: string | { readonly [x: string]: unknown } | undefined
    readonly examplesCompilerOptions?: string | { readonly [x: string]: unknown } | undefined
  },
  {
    readonly $schema?: string | undefined
    readonly projectHomepage?: string | undefined
    readonly srcDir?: string | undefined
    readonly outDir?: string | undefined
    readonly theme?: string | undefined
    readonly enableSearch?: boolean | undefined
    readonly enforceDescriptions?: boolean | undefined
    readonly enforceExamples?: boolean | undefined
    readonly enforceVersion?: boolean | undefined
    readonly exclude?: readonly string[] | undefined
    readonly parseCompilerOptions?: string | { readonly [x: string]: unknown } | undefined
    readonly examplesCompilerOptions?: string | { readonly [x: string]: unknown } | undefined
  }
>
```

Added in v1.0.0
