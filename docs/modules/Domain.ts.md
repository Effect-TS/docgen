---
title: Domain.ts
nav_order: 4
parent: Modules
---

## Domain overview

Since v0.6.0

---

## Exports Grouped by Category

- [model](#model)
  - [Class (class)](#class-class)
    - [\_tag (property)](#_tag-property)
  - [Constant (class)](#constant-class)
    - [\_tag (property)](#_tag-property-1)
  - [Doc (class)](#doc-class)
  - [DocgenError (class)](#docgenerror-class)
  - [Example (class)](#example-class)
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
export declare class Class { constructor(
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
export declare class Constant { constructor(
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
export declare class Doc { constructor(
    readonly description: string | undefined,
    readonly since: string | undefined,
    readonly deprecated: boolean,
    readonly examples: ReadonlyArray<Example>,
    readonly category: string | undefined
  ) }
```

Since v0.6.0

## DocgenError (class)

**Signature**

```ts
export declare class DocgenError
```

Since v0.6.0

## Example (class)

**Signature**

```ts
export declare class Example { constructor(readonly body: string) }
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
export declare class Export { constructor(
    readonly name: string,
    readonly doc: Doc,
    readonly signature: string,
    readonly namespaceExport: boolean
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
export declare class File { constructor(
    readonly path: string,
    readonly content: string,
    readonly isOverwriteable: boolean = false
  ) }
```

Since v0.6.0

## Function (class)

**Signature**

```ts
export declare class Function { constructor(
    readonly name: string,
    readonly doc: Doc,
    readonly signatures: ReadonlyArray<string>,
    readonly throws: ReadonlyArray<string>,
    readonly sees: ReadonlyArray<string>
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
export declare class Interface { constructor(
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
export declare class Method { constructor(
    readonly name: string,
    readonly doc: Doc,
    readonly signatures: ReadonlyArray<string>
  ) }
```

Since v0.6.0

## Module (class)

**Signature**

```ts
export declare class Module { constructor(
    readonly name: string,
    readonly doc: Doc,
    readonly path: ReadonlyArray<string>,
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
export declare class Namespace { constructor(
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

## Property (class)

**Signature**

```ts
export declare class Property { constructor(
    readonly name: string,
    readonly doc: Doc,
    readonly signature: string
  ) }
```

Since v0.6.0

## TypeAlias (class)

**Signature**

```ts
export declare class TypeAlias { constructor(
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
export declare class Process
```

Since v0.6.0

# sorting

## ByPath

A comparator function for sorting `Module` objects by their file path, represented as a string.
The file path is converted to lowercase before comparison.

**Signature**

```ts
export declare const ByPath: Order.Order<Module>
```

Since v0.6.0

# symbol

## DocgenErrorTypeId

**Signature**

```ts
export declare const DocgenErrorTypeId: typeof DocgenErrorTypeId
```

Since v0.6.0

## DocgenErrorTypeId (type alias)

**Signature**

```ts
export type DocgenErrorTypeId = typeof DocgenErrorTypeId
```

Since v0.6.0
