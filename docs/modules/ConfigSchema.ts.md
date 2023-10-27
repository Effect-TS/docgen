---
title: ConfigSchema.ts
nav_order: 4
parent: Modules
---

## ConfigSchema overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [service](#service)
  - [ConfigSchema](#configschema)
  - [PartialConfigSchema](#partialconfigschema)

---

# service

## ConfigSchema

**Signature**

```ts
export declare const ConfigSchema: Schema.Schema<
  {
    readonly projectHomepage: string
    readonly srcDir: string
    readonly outDir: string
    readonly theme: string
    readonly enableSearch: boolean
    readonly enforceDescriptions: boolean
    readonly enforceExamples: boolean
    readonly enforceVersion: boolean
    readonly exclude: readonly string[]
    readonly parseCompilerOptions: string | { readonly [x: string]: unknown }
    readonly examplesCompilerOptions: string | { readonly [x: string]: unknown }
  },
  {
    readonly projectHomepage: string
    readonly srcDir: string
    readonly outDir: string
    readonly theme: string
    readonly enableSearch: boolean
    readonly enforceDescriptions: boolean
    readonly enforceExamples: boolean
    readonly enforceVersion: boolean
    readonly exclude: readonly string[]
    readonly parseCompilerOptions: string | { readonly [x: string]: unknown }
    readonly examplesCompilerOptions: string | { readonly [x: string]: unknown }
  }
>
```

Added in v1.0.0

## PartialConfigSchema

**Signature**

```ts
export declare const PartialConfigSchema: Schema.Schema<
  {
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
