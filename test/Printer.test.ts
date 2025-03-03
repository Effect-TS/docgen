import * as Domain from "@effect/docgen/Domain"
import * as Printer from "@effect/docgen/Printer"
import * as Effect from "effect/Effect"
import { flow } from "effect/Function"
import * as Option from "effect/Option"
import * as assert from "node:assert/strict"
import { describe, it } from "vitest"

const testCases = {
  class: new Domain.Class(
    new Domain.NamedDoc(
      "A",
      Option.some("a class"),
      Option.some("1.0.0"),
      false,
      [
        new Domain.Example(`\`\`\`ts
example 1
\`\`\``)
      ],
      Option.some("category")
    ),
    "declare class A { constructor() }",
    [
      new Domain.Method(
        new Domain.NamedDoc(
          "hasOwnProperty",
          Option.none(),
          Option.some("1.0.0"),
          false,
          [],
          Option.none()
        ),
        ["hasOwnProperty(): boolean"]
      )
    ],
    [
      new Domain.Method(
        new Domain.NamedDoc(
          "staticTest",
          Option.none(),
          Option.some("1.0.0"),
          false,
          [],
          Option.none()
        ),
        ["static testStatic(): string;"]
      )
    ],
    [
      new Domain.Property(
        new Domain.NamedDoc(
          "foo",
          Option.none(),
          Option.some("1.0.0"),
          false,
          [],
          Option.none()
        ),
        "foo: string"
      )
    ]
  ),
  constant: new Domain.Constant(
    new Domain.NamedDoc(
      "test",
      Option.some("the test"),
      Option.some("1.0.0"),
      false,
      [],
      Option.some("constants")
    ),
    "declare const test: string"
  ),
  export: new Domain.Export(
    new Domain.NamedDoc(
      "test",
      Option.none(),
      Option.some("1.0.0"),
      false,
      [],
      Option.none()
    ),
    "export declare const test: typeof test"
  ),
  function: new Domain.Function(
    new Domain.NamedDoc(
      "func",
      Option.some("a function"),
      Option.some("1.0.0"),
      true,
      [
        new Domain.Example(`\`\`\`ts
example 1
\`\`\``)
      ],
      Option.none()
    ),
    ["declare const func: (test: string) => string"],
    []
  ),
  interface: new Domain.Interface(
    new Domain.NamedDoc(
      "A",
      Option.none(),
      Option.some("1.0.0"),
      false,
      [],
      Option.none()
    ),
    "export interface A extends Record<string, unknown> {}"
  ),
  typeAlias: new Domain.TypeAlias(
    new Domain.NamedDoc(
      "A",
      Option.none(),
      Option.some("1.0.0"),
      false,
      [],
      Option.none()
    ),
    "export type A = number"
  ),
  namespace: new Domain.Namespace(
    new Domain.NamedDoc(
      "A",
      Option.none(),
      Option.some("1.0.0"),
      false,
      [],
      Option.none()
    ),
    [],
    [
      new Domain.TypeAlias(
        new Domain.NamedDoc(
          "B",
          Option.none(),
          Option.some("1.0.1"),
          false,
          [],
          Option.none()
        ),
        "export type B = string"
      )
    ],
    [
      new Domain.Namespace(
        new Domain.NamedDoc(
          "C",
          Option.none(),
          Option.some("1.0.2"),
          false,
          [],
          Option.none()
        ),
        [],
        [
          new Domain.TypeAlias(
            new Domain.NamedDoc(
              "D",
              Option.none(),
              Option.some("1.0.3"),
              false,
              [],
              Option.none()
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
      await Effect.runPromise(print({ ...testCases.typeAlias, since: Option.none() }, 0)),
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
      Option.none(),
      Option.some("1.0.0"),
      false,
      [],
      Option.none()
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
