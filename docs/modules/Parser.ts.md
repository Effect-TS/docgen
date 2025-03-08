---
title: Parser.ts
nav_order: 7
parent: Modules
---

## Parser.ts overview

Since v0.6.0

---

## Exports Grouped by Category

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
export declare const parseClasses: Effect.Effect<Domain.Class[], never, Source>
```

Since v0.6.0

## parseConstants

**Signature**

```ts
export declare const parseConstants: Effect.Effect<Domain.Constant[], never, Source>
```

Since v0.6.0

## parseExports

**Signature**

```ts
export declare const parseExports: Effect.Effect<Domain.Export[], never, Source>
```

Since v0.6.0

## parseFiles

**Signature**

```ts
export declare const parseFiles: (
  files: ReadonlyArray<Domain.File>
) => Effect.Effect<Domain.Module[], [string[], ...string[][]], Configuration.Configuration | Domain.Process | Path.Path>
```

Since v0.6.0

## parseFunctions

**Signature**

```ts
export declare const parseFunctions: Effect.Effect<Domain.Function[], never, Source>
```

Since v0.6.0

## parseInterfaces

**Signature**

```ts
export declare const parseInterfaces: Effect.Effect<Domain.Interface[], never, Source>
```

Since v0.6.0

## parseModule

**Signature**

```ts
export declare const parseModule: Effect.Effect<Domain.Module, never, Configuration.Configuration | Source>
```

Since v0.6.0

## parseNamespaces

**Signature**

```ts
export declare const parseNamespaces: Effect.Effect<Domain.Namespace[], never, Configuration.Configuration | Source>
```

Since v0.6.0

## parseTypeAliases

**Signature**

```ts
export declare const parseTypeAliases: Effect.Effect<Domain.TypeAlias[], never, Source>
```

Since v0.6.0
