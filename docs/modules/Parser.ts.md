---
title: Parser.ts
nav_order: 9
parent: Modules
---

## Parser overview

Since v0.6.0

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
export declare const parseClasses: Effect.Effect<Domain.Class[], string[], Configuration.Configuration | Source>
```

Since v0.6.0

## parseConstants

**Signature**

```ts
export declare const parseConstants: Effect.Effect<
  Domain.Constant[],
  [string, ...string[]],
  Configuration.Configuration | Source
>
```

Since v0.6.0

## parseExports

**Signature**

```ts
export declare const parseExports: Effect.Effect<
  Domain.Export[],
  [string, ...string[]],
  Configuration.Configuration | Source
>
```

Since v0.6.0

## parseFiles

**Signature**

```ts
export declare const parseFiles: (
  files: ReadonlyArray<File.File>
) => Effect.Effect<
  Domain.Module[],
  [string[], ...string[][]],
  Process.Process | Configuration.Configuration | Path.Path
>
```

Since v0.6.0

## parseFunctions

**Signature**

```ts
export declare const parseFunctions: Effect.Effect<
  Domain.Function[],
  [string, ...string[]],
  Configuration.Configuration | Source
>
```

Since v0.6.0

## parseInterfaces

**Signature**

```ts
export declare const parseInterfaces: Effect.Effect<
  Domain.Interface[],
  [string, ...string[]],
  Configuration.Configuration | Source
>
```

Since v0.6.0

## parseModule

**Signature**

```ts
export declare const parseModule: Effect.Effect<
  Domain.Module,
  string[],
  Configuration.Configuration | Path.Path | Source
>
```

Since v0.6.0

## parseNamespaces

**Signature**

```ts
export declare const parseNamespaces: Effect.Effect<Domain.Namespace[], string[], Configuration.Configuration | Source>
```

Since v0.6.0

## parseTypeAliases

**Signature**

```ts
export declare const parseTypeAliases: Effect.Effect<
  Domain.TypeAlias[],
  [string, ...string[]],
  Configuration.Configuration | Source
>
```

Since v0.6.0
