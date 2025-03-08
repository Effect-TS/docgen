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

Since v0.6.0

## checkConstants

**Signature**

```ts
declare const checkConstants: (_constants: ReadonlyArray<Domain.Constant>) => Effect.Effect<Array<never>, never, never>
```

Since v0.6.0

## checkExports

**Signature**

```ts
declare const checkExports: (_exports: ReadonlyArray<Domain.Export>) => Effect.Effect<Array<never>, never, never>
```

Since v0.6.0

## checkFunctions

**Signature**

```ts
declare const checkFunctions: (
  functions: ReadonlyArray<Domain.Function>
) => Effect.Effect<Array<string>, never, Parser.Source>
```

Since v0.6.0

## checkInterfaces

**Signature**

```ts
declare const checkInterfaces: (
  _interfaces: ReadonlyArray<Domain.Interface>
) => Effect.Effect<Array<never>, never, never>
```

Since v0.6.0

## checkModule

**Signature**

```ts
declare const checkModule: (_module: Domain.Module) => Effect.Effect<Array<never>, never, never>
```

Since v0.6.0

## checkNamespaces

**Signature**

```ts
declare const checkNamespaces: (
  _namespaces: ReadonlyArray<Domain.Namespace>
) => Effect.Effect<Array<never>, never, never>
```

Since v0.6.0

## checkTypeAliases

**Signature**

```ts
declare const checkTypeAliases: (
  _typeAliases: ReadonlyArray<Domain.TypeAlias>
) => Effect.Effect<Array<never>, never, never>
```

Since v0.6.0
