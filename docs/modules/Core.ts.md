---
title: Core.ts
nav_order: 4
parent: Modules
---

## Core overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructors](#constructors)
  - [ParseError](#parseerror)
- [main](#main)
  - [main](#main-1)
- [model](#model)
  - [ParseError (interface)](#parseerror-interface)

---

# constructors

## ParseError

**Signature**

```ts
export declare const ParseError: Data.Case.Constructor<ParseError, '_tag'>
```

Added in v1.0.0

# main

## main

**Signature**

```ts
export declare const main: unknown
```

Added in v1.0.0

# model

## ParseError (interface)

Represents errors that occurred during parsing of TypeScript source files.

**Signature**

```ts
export interface ParseError extends Data.Case {
  readonly _tag: 'ParseError'
  readonly message: string
}
```

Added in v1.0.0
