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
  - [Configuration (class)](#configuration-class)
  - [ConfigurationSchema](#configurationschema)
  - [ConfigurationShape (interface)](#configurationshape-interface)

---

# service

## Configuration (class)

**Signature**

```ts
export declare class Configuration
```

Added in v1.0.0

## ConfigurationSchema

**Signature**

```ts
export declare const ConfigurationSchema: Schema.Struct<{
  $schema: Schema.PropertySignature<"?:", string | undefined, never, "?:", string | undefined, never>
  projectHomepage: Schema.PropertySignature<"?:", string | undefined, never, "?:", string | undefined, never>
  srcDir: Schema.PropertySignature<"?:", string | undefined, never, "?:", string | undefined, never>
  outDir: Schema.PropertySignature<"?:", string | undefined, never, "?:", string | undefined, never>
  theme: Schema.PropertySignature<"?:", string | undefined, never, "?:", string | undefined, never>
  enableSearch: Schema.PropertySignature<"?:", boolean | undefined, never, "?:", boolean | undefined, never>
  enforceDescriptions: Schema.PropertySignature<"?:", boolean | undefined, never, "?:", boolean | undefined, never>
  enforceExamples: Schema.PropertySignature<"?:", boolean | undefined, never, "?:", boolean | undefined, never>
  enforceVersion: Schema.PropertySignature<"?:", boolean | undefined, never, "?:", boolean | undefined, never>
  exclude: Schema.PropertySignature<
    "?:",
    readonly string[] | undefined,
    never,
    "?:",
    readonly string[] | undefined,
    never
  >
  parseCompilerOptions: Schema.PropertySignature<
    "?:",
    string | { readonly [x: string]: unknown } | undefined,
    never,
    "?:",
    string | { readonly [x: string]: unknown } | undefined,
    never
  >
  examplesCompilerOptions: Schema.PropertySignature<
    "?:",
    string | { readonly [x: string]: unknown } | undefined,
    never,
    "?:",
    string | { readonly [x: string]: unknown } | undefined,
    never
  >
}>
```

Added in v1.0.0

## ConfigurationShape (interface)

**Signature**

```ts
export interface ConfigurationShape {
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
