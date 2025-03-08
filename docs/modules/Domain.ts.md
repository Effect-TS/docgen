---
title: Domain.ts
nav_order: 5
parent: Modules
---

## Domain.ts overview

Since v0.6.0

---

## Exports Grouped by Category

- [model](#model)
  - [Class (class)](#class-class)
    - [\_tag (property)](#_tag-property)
  - [Constant (class)](#constant-class)
    - [\_tag (property)](#_tag-property-1)
  - [Doc (class)](#doc-class)
    - [modifyDescription (method)](#modifydescription-method)
  - [DocgenError (class)](#docgenerror-class)
  - [Export (class)](#export-class)
    - [\_tag (property)](#_tag-property-2)
  - [File (class)](#file-class)
  - [Function (class)](#function-class)
    - [\_tag (property)](#_tag-property-3)
  - [Interface (class)](#interface-class)
    - [\_tag (property)](#_tag-property-4)
  - [Method (class)](#method-class)
  - [Module (class)](#module-class)
    - [\_tag (property)](#_tag-property-5)
  - [Namespace (class)](#namespace-class)
    - [\_tag (property)](#_tag-property-6)
  - [Position (interface)](#position-interface)
  - [Property (class)](#property-class)
  - [TypeAlias (class)](#typealias-class)
    - [\_tag (property)](#_tag-property-7)
- [service](#service)
  - [Process (class)](#process-class)
- [sorting](#sorting)
  - [ByPath](#bypath)
- [symbol](#symbol)
  - [DocgenErrorTypeId](#docgenerrortypeid)
  - [DocgenErrorTypeId (type alias)](#docgenerrortypeid-type-alias)

---

# model

## Class (class)

**Signature**

```ts
declare class Class { constructor(
    readonly name: string,
    readonly doc: Doc,
    readonly signature: string,
    readonly methods: ReadonlyArray<Method>,
    readonly staticMethods: ReadonlyArray<Method>,
    readonly properties: ReadonlyArray<Property>
  ) }
```

Since v0.6.0

### \_tag (property)

**Signature**

```ts
readonly _tag: "Class"
```

Since v0.6.0

## Constant (class)

**Signature**

```ts
declare class Constant { constructor(
    readonly name: string,
    readonly doc: Doc,
    readonly signature: string
  ) }
```

Since v0.6.0

### \_tag (property)

**Signature**

```ts
readonly _tag: "Constant"
```

Since v0.6.0

## Doc (class)

**Signature**

```ts
declare class Doc { constructor(
    readonly description: string | undefined,
    readonly since: ReadonlyArray<string>,
    readonly deprecated: ReadonlyArray<string>,
    readonly examples: ReadonlyArray<string>,
    readonly category: ReadonlyArray<string>,
    readonly throws: ReadonlyArray<string>,
    readonly sees: ReadonlyArray<string>,
    readonly tags: Record<string, ReadonlyArray<string> | undefined>
  ) }
```

Since v0.6.0

### modifyDescription (method)

**Signature**

```ts
declare const modifyDescription: (description: string | undefined) => Doc
```

## DocgenError (class)

**Signature**

```ts
declare class DocgenError
```

Since v0.6.0

## Export (class)

These are manual exports, like:

```ts skip-type-checking
const _null = ...

export {
  _null as null
}
```

**Signature**

```ts
declare class Export { constructor(
    readonly name: string,
    readonly doc: Doc,
    readonly signature: string,
    readonly isNamespaceExport: boolean
  ) }
```

Since v0.6.0

### \_tag (property)

**Signature**

```ts
readonly _tag: "Export"
```

Since v0.6.0

## File (class)

Represents a file which can be optionally overwriteable.

**Signature**

```ts
declare class File { constructor(
    readonly path: string,
    readonly content: string,
    readonly isOverwriteable: boolean = false
  ) }
```

Since v0.6.0

## Function (class)

**Signature**

```ts
declare class Function { constructor(
    readonly position: Position,
    readonly name: string,
    readonly doc: Doc,
    readonly signature: string
  ) }
```

Since v0.6.0

### \_tag (property)

**Signature**

```ts
readonly _tag: "Function"
```

Since v0.6.0

## Interface (class)

**Signature**

```ts
declare class Interface { constructor(
    readonly name: string,
    readonly doc: Doc,
    readonly signature: string
  ) }
```

Since v0.6.0

### \_tag (property)

**Signature**

```ts
readonly _tag: "Interface"
```

Since v0.6.0

## Method (class)

**Signature**

```ts
declare class Method { constructor(
    readonly name: string,
    readonly doc: Doc,
    readonly signature: string
  ) }
```

Since v0.6.0

## Module (class)

**Signature**

```ts
declare class Module { constructor(
    readonly name: string,
    readonly doc: Doc,
    readonly path: Array.NonEmptyReadonlyArray<string>,
    readonly classes: ReadonlyArray<Class>,
    readonly interfaces: ReadonlyArray<Interface>,
    readonly functions: ReadonlyArray<Function>,
    readonly typeAliases: ReadonlyArray<TypeAlias>,
    readonly constants: ReadonlyArray<Constant>,
    readonly exports: ReadonlyArray<Export>,
    readonly namespaces: ReadonlyArray<Namespace>
  ) }
```

Since v0.6.0

### \_tag (property)

**Signature**

```ts
readonly _tag: "Module"
```

Since v0.6.0

## Namespace (class)

**Signature**

```ts
declare class Namespace { constructor(
    readonly name: string,
    readonly doc: Doc,
    readonly interfaces: ReadonlyArray<Interface>,
    readonly typeAliases: ReadonlyArray<TypeAlias>,
    readonly namespaces: ReadonlyArray<Namespace>
  ) }
```

Since v0.6.0

### \_tag (property)

**Signature**

```ts
readonly _tag: "Namespace"
```

Since v0.6.0

## Position (interface)

**Signature**

```ts
export interface Position {
  readonly line: number
  readonly column: number
}
```

Since v0.6.0

## Property (class)

**Signature**

```ts
declare class Property { constructor(
    readonly name: string,
    readonly doc: Doc,
    readonly signature: string
  ) }
```

Since v0.6.0

## TypeAlias (class)

**Signature**

```ts
declare class TypeAlias { constructor(
    readonly name: string,
    readonly doc: Doc,
    readonly signature: string
  ) }
```

Since v0.6.0

### \_tag (property)

**Signature**

```ts
readonly _tag: "TypeAlias"
```

Since v0.6.0

# service

## Process (class)

Represents a handle to the currently executing process.

**Signature**

```ts
declare class Process
```

Since v0.6.0

# sorting

## ByPath

A comparator function for sorting `Module` objects by their file path, represented as a string.
The file path is converted to lowercase before comparison.

**Signature**

```ts
declare const ByPath: Order.Order<Module>
```

Since v0.6.0

# symbol

## DocgenErrorTypeId

**Signature**

```ts
declare const DocgenErrorTypeId: unique symbol
```

Since v0.6.0

## DocgenErrorTypeId (type alias)

**Signature**

```ts
type DocgenErrorTypeId = typeof DocgenErrorTypeId
```

Since v0.6.0
