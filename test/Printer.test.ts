import * as Domain from "@effect/docgen/Domain"
import * as Printer from "@effect/docgen/Printer"
import * as Effect from "effect/Effect"
import { flow } from "effect/Function"
import * as assert from "node:assert/strict"
import { describe, it } from "vitest"

const testCases = {
  class: new Domain.Class(
    new Domain.NamedDoc(
      "A",
      "a class",
      "1.0.0",
      false,
      [
        new Domain.Example(`\`\`\`ts
example 1
\`\`\``)
      ],
      "category"
    ),
    "declare class A { constructor() }",
    [
      new Domain.Method(
        new Domain.NamedDoc(
          "hasOwnProperty",
          undefined,
          "1.0.0",
          false,
          [],
          undefined
        ),
        ["hasOwnProperty(): boolean"]
      )
    ],
    [
      new Domain.Method(
        new Domain.NamedDoc(
          "staticTest",
          undefined,
          "1.0.0",
          false,
          [],
          undefined
        ),
        ["static testStatic(): string;"]
      )
    ],
    [
      new Domain.Property(
        new Domain.NamedDoc(
          "foo",
          undefined,
          "1.0.0",
          false,
          [],
          undefined
        ),
        "foo: string"
      )
    ]
  ),
  constant: new Domain.Constant(
    new Domain.NamedDoc(
      "test",
      "the test",
      "1.0.0",
      false,
      [],
      "constants"
    ),
    "declare const test: string"
  ),
  export: new Domain.Export(
    new Domain.NamedDoc(
      "test",
      undefined,
      "1.0.0",
      false,
      [],
      undefined
    ),
    "export declare const test: typeof test"
  ),
  function: new Domain.Function(
    new Domain.NamedDoc(
      "func",
      "a function",
      "1.0.0",
      true,
      [
        new Domain.Example(`\`\`\`ts
example 1
\`\`\``)
      ],
      undefined
    ),
    ["declare const func: (test: string) => string"],
    []
  ),
  interface: new Domain.Interface(
    new Domain.NamedDoc(
      "A",
      undefined,
      "1.0.0",
      false,
      [],
      undefined
    ),
    "export interface A extends Record<string, unknown> {}"
  ),
  typeAlias: new Domain.TypeAlias(
    new Domain.NamedDoc(
      "A",
      undefined,
      "1.0.0",
      false,
      [],
      undefined
    ),
    "export type A = number"
  ),
  namespace: new Domain.Namespace(
    new Domain.NamedDoc(
      "A",
      undefined,
      "1.0.0",
      false,
      [],
      undefined
    ),
    [],
    [
      new Domain.TypeAlias(
        new Domain.NamedDoc(
          "B",
          undefined,
          "1.0.1",
          false,
          [],
          undefined
        ),
        "export type B = string"
      )
    ],
    [
      new Domain.Namespace(
        new Domain.NamedDoc(
          "C",
          undefined,
          "1.0.2",
          false,
          [],
          undefined
        ),
        [],
        [
          new Domain.TypeAlias(
            new Domain.NamedDoc(
              "D",
              undefined,
              "1.0.3",
              false,
              [],
              undefined
            ),
            "export type D = number"
          )
        ],
        []
      )
    ]
  )
}

describe("Markdown", () => {
  it("printNamespace", async () => {
    const print = flow(Printer.printNamespace, Printer.prettify)
    assert.strictEqual(
      await Effect.runPromise(print(testCases.namespace, 0)),
      `## A (namespace)

Since v1.0.0

### B (type alias)

**Signature**

\`\`\`ts
export type B = string
\`\`\`

Since v1.0.1

### C (namespace)

Since v1.0.2

#### D (type alias)

**Signature**

\`\`\`ts
export type D = number
\`\`\`

Since v1.0.3
`
    )
  })

  it("printClass", async () => {
    const print = flow(Printer.printClass, Printer.prettify)
    assert.strictEqual(
      await Effect.runPromise(print(testCases.class)),
      `## A (class)

a class

**Example**

\`\`\`ts
example 1
\`\`\`

**Signature**

\`\`\`ts
declare class A {
  constructor()
}
\`\`\`

Since v1.0.0

### staticTest (static method)

**Signature**

\`\`\`ts
static testStatic(): string;
\`\`\`

Since v1.0.0

### hasOwnProperty (function) (method)

**Signature**

\`\`\`ts
hasOwnProperty(): boolean
\`\`\`

Since v1.0.0

### foo (property)

**Signature**

\`\`\`ts
foo: string
\`\`\`

Since v1.0.0
`
    )
  })

  it("printConstant", async () => {
    const print = flow(Printer.printConstant, Printer.prettify)
    assert.strictEqual(
      await Effect.runPromise(print(testCases.constant)),
      `## test

the test

**Signature**

\`\`\`ts
declare const test: string
\`\`\`

Since v1.0.0
`
    )
  })

  it("printExport", async () => {
    const print = flow(Printer.printExport, Printer.prettify)
    assert.strictEqual(
      await Effect.runPromise(print(testCases.export)),
      `## test

**Signature**

\`\`\`ts
export declare const test: typeof test
\`\`\`

Since v1.0.0
`
    )
  })

  it("printFunction", async () => {
    const print = flow(Printer.printFunction, Printer.prettify)
    assert.strictEqual(
      await Effect.runPromise(print(testCases.function)),
      `## ~~func~~

a function

**Example**

\`\`\`ts
example 1
\`\`\`

**Signature**

\`\`\`ts
declare const func: (test: string) => string
\`\`\`

Since v1.0.0
`
    )
  })

  it("printInterface", async () => {
    const print = flow(Printer.printInterface, Printer.prettify)
    assert.strictEqual(
      await Effect.runPromise(print(testCases.interface, 0)),
      `## A (interface)

**Signature**

\`\`\`ts
export interface A extends Record<string, unknown> {}
\`\`\`

Since v1.0.0
`
    )
  })

  it("printTypeAlias", async () => {
    const print = flow(Printer.printTypeAlias, Printer.prettify)
    assert.strictEqual(
      await Effect.runPromise(print(testCases.typeAlias, 0)),
      `## A (type alias)

**Signature**

\`\`\`ts
export type A = number
\`\`\`

Since v1.0.0
`
    )

    assert.strictEqual(
      await Effect.runPromise(print({ ...testCases.typeAlias, since: undefined }, 0)),
      `## A (type alias)

**Signature**

\`\`\`ts
export type A = number
\`\`\`
`
    )
  })

  it("printModule", async () => {
    const doc = new Domain.NamedDoc(
      "tests",
      undefined,
      "1.0.0",
      false,
      [],
      undefined
    )
    assert.strictEqual(
      await Effect.runPromise(Printer.printModule(
        new Domain.Module(
          doc,
          ["src", "tests.ts"],
          [testCases.class],
          [testCases.interface],
          [testCases.function],
          [testCases.typeAlias],
          [testCases.constant],
          [testCases.export],
          [testCases.namespace]
        ),
        1
      )),
      `---
title: tests.ts
nav_order: 1
parent: Modules
---

## tests overview

Since v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [category](#category)
  - [A (class)](#a-class)
    - [staticTest (static method)](#statictest-static-method)
    - [hasOwnProperty (function) (method)](#hasownproperty-function-method)
    - [foo (property)](#foo-property)
- [constants](#constants)
  - [test](#test)
- [utils](#utils)
  - [A (interface)](#a-interface)
  - [A (type alias)](#a-type-alias)
  - [A (namespace)](#a-namespace)
    - [B (type alias)](#b-type-alias)
    - [C (namespace)](#c-namespace)
      - [D (type alias)](#d-type-alias)
  - [~~func~~](#func)
  - [test](#test-1)

---

# category

## A (class)

a class

**Example**

\`\`\`ts
example 1
\`\`\`

**Signature**

\`\`\`ts
declare class A {
  constructor()
}
\`\`\`

Since v1.0.0

### staticTest (static method)

**Signature**

\`\`\`ts
static testStatic(): string;
\`\`\`

Since v1.0.0

### hasOwnProperty (function) (method)

**Signature**

\`\`\`ts
hasOwnProperty(): boolean
\`\`\`

Since v1.0.0

### foo (property)

**Signature**

\`\`\`ts
foo: string
\`\`\`

Since v1.0.0

# constants

## test

the test

**Signature**

\`\`\`ts
declare const test: string
\`\`\`

Since v1.0.0

# utils

## A (interface)

**Signature**

\`\`\`ts
export interface A extends Record<string, unknown> {}
\`\`\`

Since v1.0.0

## A (type alias)

**Signature**

\`\`\`ts
export type A = number
\`\`\`

Since v1.0.0

## A (namespace)

Since v1.0.0

### B (type alias)

**Signature**

\`\`\`ts
export type B = string
\`\`\`

Since v1.0.1

### C (namespace)

Since v1.0.2

#### D (type alias)

**Signature**

\`\`\`ts
export type D = number
\`\`\`

Since v1.0.3

## ~~func~~

a function

**Example**

\`\`\`ts
example 1
\`\`\`

**Signature**

\`\`\`ts
declare const func: (test: string) => string
\`\`\`

Since v1.0.0

## test

**Signature**

\`\`\`ts
export declare const test: typeof test
\`\`\`

Since v1.0.0
`
    )

    const empty = new Domain.Module(doc, ["src", "tests.ts"], [], [], [], [], [], [], [])

    assert.strictEqual(
      await Effect.runPromise(Printer.printModule(empty, 1)),
      `---
title: tests.ts
nav_order: 1
parent: Modules
---

## tests overview

Since v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

---
`
    )
  })
})
