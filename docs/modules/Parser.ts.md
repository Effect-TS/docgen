---
title: Parser.ts
nav_order: 8
parent: Modules
---

## Parser overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [parsers](#parsers)
  - [parseClasses](#parseclasses)
  - [parseConstants](#parseconstants)
  - [parseExports](#parseexports)
  - [parseFiles](#parsefiles)
  - [parseFunctions](#parsefunctions)
  - [parseInterfaces](#parseinterfaces)
  - [parseModule](#parsemodule)
  - [parseNamespaces](#parsenamespaces)
  - [parseTypeAliases](#parsetypealiases)

---

# parsers

## parseClasses

**Signature**

```ts
export declare const parseClasses: Effect.Effect<Configuration.Configuration | Source, string[], Domain.Class[]>
```

Added in v1.0.0

## parseConstants

**Signature**

```ts
export declare const parseConstants: Effect.Effect<Configuration.Configuration | Source, string[], Domain.Constant[]>
```

Added in v1.0.0

## parseExports

**Signature**

```ts
export declare const parseExports: Effect.Effect<Configuration.Configuration | Source, string[], Domain.Export[]>
```

Added in v1.0.0

## parseFiles

**Signature**

```ts
export declare const parseFiles: (
  files: ReadonlyArray<File.File>
) => Effect.Effect<Process.Process | Configuration.Configuration | Path.Path, string[][], Domain.Module[]>
```

Added in v1.0.0

## parseFunctions

**Signature**

```ts
export declare const parseFunctions: Effect.Effect<Configuration.Configuration | Source, string[], Domain.Function[]>
```

Added in v1.0.0

## parseInterfaces

**Signature**

```ts
export declare const parseInterfaces: Effect.Effect<Configuration.Configuration | Source, string[], Domain.Interface[]>
```

Added in v1.0.0

## parseModule

**Signature**

```ts
export declare const parseModule: Effect.Effect<
  Configuration.Configuration | Path.Path | Source,
  string[],
  Domain.Module
>
```

Added in v1.0.0

## parseNamespaces

**Signature**

```ts
export declare const parseNamespaces: Effect.Effect<Configuration.Configuration | Source, string[], Domain.Namespace[]>
```

Added in v1.0.0

## parseTypeAliases

**Signature**

```ts
export declare const parseTypeAliases: Effect.Effect<Configuration.Configuration | Source, string[], Domain.TypeAlias[]>
```

Added in v1.0.0
