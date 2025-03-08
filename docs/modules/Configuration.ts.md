---
title: Configuration.ts
nav_order: 3
parent: Modules
---

## Configuration.ts overview

Since v0.6.0

---

## Exports Grouped by Category

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

Since v0.6.0

## ConfigurationSchema

**Signature**

```ts
export declare const ConfigurationSchema: Schema.Struct<{
  $schema: Schema.optional<typeof Schema.String>
  projectHomepage: Schema.optional<typeof Schema.String>
  srcDir: Schema.optional<typeof Schema.String>
  outDir: Schema.optional<typeof Schema.String>
  theme: Schema.optional<typeof Schema.String>
  enableSearch: Schema.optional<typeof Schema.Boolean>
  enforceDescriptions: Schema.optional<typeof Schema.Boolean>
  enforceExamples: Schema.optional<typeof Schema.Boolean>
  enforceVersion: Schema.optional<typeof Schema.Boolean>
  exclude: Schema.optional<Schema.Array$<typeof Schema.String>>
  parseCompilerOptions: Schema.optional<
    Schema.Union<[typeof Schema.String, Schema.Record$<typeof Schema.String, typeof Schema.Unknown>]>
  >
  examplesCompilerOptions: Schema.optional<
    Schema.Union<[typeof Schema.String, Schema.Record$<typeof Schema.String, typeof Schema.Unknown>]>
  >
}>
```

Since v0.6.0

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

Since v0.6.0
