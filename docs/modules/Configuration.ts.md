---
title: Configuration.ts
nav_order: 2
parent: Modules
---

## Configuration overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [service](#service)
  - [Configuration](#configuration)
  - [Configuration (interface)](#configuration-interface)
  - [ConfigurationSchema](#configurationschema)

---

# service

## Configuration

**Signature**

```ts
export declare const Configuration: Context.Tag<Configuration, Configuration>
```

Added in v1.0.0

## Configuration (interface)

**Signature**

```ts
export interface Configuration {
  readonly projectName: string
  readonly projectHomepage: string
  readonly srcDir: string
  readonly outDir: string
  readonly theme: string
  readonly enableSearch: boolean
  readonly enforceDescriptions: boolean
  readonly enforceExamples: boolean
  readonly enforceVersion: boolean
  readonly runExamples: boolean
  readonly exclude: ReadonlyArray<string>
  readonly parseCompilerOptions: Record<string, unknown>
  readonly examplesCompilerOptions: Record<string, unknown>
}
```

Added in v1.0.0

## ConfigurationSchema

**Signature**

```ts
export declare const ConfigurationSchema: Schema.Schema<
  {
    readonly $schema?: string
    readonly projectHomepage?: string
    readonly srcDir?: string
    readonly outDir?: string
    readonly theme?: string
    readonly enableSearch?: boolean
    readonly enforceDescriptions?: boolean
    readonly enforceExamples?: boolean
    readonly enforceVersion?: boolean
    readonly exclude?: readonly string[]
    readonly parseCompilerOptions?: string | { readonly [x: string]: unknown }
    readonly examplesCompilerOptions?: string | { readonly [x: string]: unknown }
  },
  {
    readonly $schema?: string
    readonly projectHomepage?: string
    readonly srcDir?: string
    readonly outDir?: string
    readonly theme?: string
    readonly enableSearch?: boolean
    readonly enforceDescriptions?: boolean
    readonly enforceExamples?: boolean
    readonly enforceVersion?: boolean
    readonly exclude?: readonly string[]
    readonly parseCompilerOptions?: string | { readonly [x: string]: unknown }
    readonly examplesCompilerOptions?: string | { readonly [x: string]: unknown }
  }
>
```

Added in v1.0.0
