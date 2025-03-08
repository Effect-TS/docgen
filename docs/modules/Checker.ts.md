---
title: Checker.ts
nav_order: 1
parent: Modules
---

## Checker.ts overview

Since v0.6.0

---

## Exports Grouped by Category

- [utils](#utils)
  - [checkClasses](#checkclasses)
  - [checkConstants](#checkconstants)
  - [checkExports](#checkexports)
  - [checkFunctions](#checkfunctions)
  - [checkInterfaces](#checkinterfaces)
  - [checkModule](#checkmodule)
  - [checkNamespaces](#checknamespaces)
  - [checkTypeAliases](#checktypealiases)

---

# utils

## checkClasses

**Signature**

```ts
declare const checkClasses: (_classes: ReadonlyArray<Domain.Class>) => Effect.Effect<Array<never>, never, never>
```

[Source](https://github.com/effect-ts/docgen/blob/main/src/Checker.ts#L32)

Since v0.6.0

## checkConstants

**Signature**

```ts
declare const checkConstants: (_constants: ReadonlyArray<Domain.Constant>) => Effect.Effect<Array<never>, never, never>
```

[Source](https://github.com/effect-ts/docgen/blob/main/src/Checker.ts#L39)

Since v0.6.0

## checkExports

**Signature**

```ts
declare const checkExports: (_exports: ReadonlyArray<Domain.Export>) => Effect.Effect<Array<never>, never, never>
```

[Source](https://github.com/effect-ts/docgen/blob/main/src/Checker.ts#L67)

Since v0.6.0

## checkFunctions

**Signature**

```ts
declare const checkFunctions: (
  functions: ReadonlyArray<Domain.Function>
) => Effect.Effect<Array<string>, never, Parser.Source>
```

[Source](https://github.com/effect-ts/docgen/blob/main/src/Checker.ts#L25)

Since v0.6.0

## checkInterfaces

**Signature**

```ts
declare const checkInterfaces: (
  _interfaces: ReadonlyArray<Domain.Interface>
) => Effect.Effect<Array<never>, never, never>
```

[Source](https://github.com/effect-ts/docgen/blob/main/src/Checker.ts#L46)

Since v0.6.0

## checkModule

**Signature**

```ts
declare const checkModule: (_module: Domain.Module) => Effect.Effect<Array<never>, never, never>
```

[Source](https://github.com/effect-ts/docgen/blob/main/src/Checker.ts#L74)

Since v0.6.0

## checkNamespaces

**Signature**

```ts
declare const checkNamespaces: (
  _namespaces: ReadonlyArray<Domain.Namespace>
) => Effect.Effect<Array<never>, never, never>
```

[Source](https://github.com/effect-ts/docgen/blob/main/src/Checker.ts#L60)

Since v0.6.0

## checkTypeAliases

**Signature**

```ts
declare const checkTypeAliases: (
  _typeAliases: ReadonlyArray<Domain.TypeAlias>
) => Effect.Effect<Array<never>, never, never>
```

[Source](https://github.com/effect-ts/docgen/blob/main/src/Checker.ts#L53)

Since v0.6.0
