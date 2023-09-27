import * as assert from "assert"
import { Option } from "effect"
import { flow } from "effect/Function"
import {
  createClass,
  createConstant,
  createExport,
  createFunction,
  createInterface,
  createMethod,
  createModule,
  createNamedDoc,
  createNamespace,
  createProperty,
  createTypeAlias
} from "../src/Domain"
import * as _ from "../src/Markdown"

const testCases = {
  class: createClass(
    createNamedDoc(
      "A",
      Option.some("a class"),
      Option.some("1.0.0"),
      false,
      ["example 1"],
      Option.some("category")
    ),
    "declare class A { constructor() }",
    [
      createMethod(
        createNamedDoc(
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
      createMethod(
        createNamedDoc(
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
      createProperty(
        createNamedDoc(
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
  constant: createConstant(
    createNamedDoc(
      "test",
      Option.some("the test"),
      Option.some("1.0.0"),
      false,
      [],
      Option.some("constants")
    ),
    "declare const test: string"
  ),
  export: createExport(
    createNamedDoc(
      "test",
      Option.none(),
      Option.some("1.0.0"),
      false,
      [],
      Option.none()
    ),
    "export declare const test: typeof test"
  ),
  function: createFunction(
    createNamedDoc(
      "func",
      Option.some("a function"),
      Option.some("1.0.0"),
      true,
      ["example 1"],
      Option.none()
    ),
    ["declare const func: (test: string) => string"]
  ),
  interface: createInterface(
    createNamedDoc(
      "A",
      Option.none(),
      Option.some("1.0.0"),
      false,
      [],
      Option.none()
    ),
    "export interface A extends Record<string, unknown> {}"
  ),
  typeAlias: createTypeAlias(
    createNamedDoc(
      "A",
      Option.none(),
      Option.some("1.0.0"),
      false,
      [],
      Option.none()
    ),
    "export type A = number"
  )
}

describe.concurrent("Markdown", () => {
  const print = flow(_.fromPrintable, _.prettify)

  it("fromNamespace", () => {
    const namespace = createNamespace(
      createNamedDoc(
        "A",
        Option.none(),
        Option.some("1.0.0"),
        false,
        [],
        Option.none()
      ),
      [],
      [
        createTypeAlias(
          createNamedDoc(
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
        createNamespace(
          createNamedDoc(
            "C",
            Option.none(),
            Option.some("1.0.2"),
            false,
            [],
            Option.none()
          ),
          [],
          [
            createTypeAlias(
              createNamedDoc(
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
    assert.strictEqual(
      print(namespace),
      `## A (namespace)

Added in v1.0.0

### B (type alias)

**Signature**

\`\`\`ts
export type B = string
\`\`\`

Added in v1.0.1

### C (namespace)

Added in v1.0.2

#### D (type alias)

**Signature**

\`\`\`ts
export type D = number
\`\`\`

Added in v1.0.3
`
    )
  })

  it("fromClass", () => {
    assert.strictEqual(
      print(testCases.class),
      `## A (class)

a class

**Signature**

\`\`\`ts
declare class A {
  constructor()
}
\`\`\`

**Example**

\`\`\`ts
example 1
\`\`\`

Added in v1.0.0

### staticTest (static method)

**Signature**

\`\`\`ts
static testStatic(): string;
\`\`\`

Added in v1.0.0

### hasOwnProperty (function) (method)

**Signature**

\`\`\`ts
hasOwnProperty(): boolean
\`\`\`

Added in v1.0.0

### foo (property)

**Signature**

\`\`\`ts
foo: string
\`\`\`

Added in v1.0.0
`
    )
  })

  it("printConstant", () => {
    assert.strictEqual(
      print(testCases.constant),
      `## test

the test

**Signature**

\`\`\`ts
declare const test: string
\`\`\`

Added in v1.0.0
`
    )
  })

  it("printExport", () => {
    assert.strictEqual(
      print(testCases.export),
      `## test

**Signature**

\`\`\`ts
export declare const test: typeof test
\`\`\`

Added in v1.0.0
`
    )
  })

  it("printFunction", () => {
    assert.strictEqual(
      print(testCases.function),
      `## ~~func~~

a function

**Signature**

\`\`\`ts
declare const func: (test: string) => string
\`\`\`

**Example**

\`\`\`ts
example 1
\`\`\`

Added in v1.0.0
`
    )
  })

  it("printInterface", () => {
    assert.strictEqual(
      print(testCases.interface),
      `## A (interface)

**Signature**

\`\`\`ts
export interface A extends Record<string, unknown> {}
\`\`\`

Added in v1.0.0
`
    )
  })

  it("printTypeAlias", () => {
    assert.strictEqual(
      print(testCases.typeAlias),
      `## A (type alias)

**Signature**

\`\`\`ts
export type A = number
\`\`\`

Added in v1.0.0
`
    )

    assert.strictEqual(
      print({ ...testCases.typeAlias, since: Option.none() }),
      `## A (type alias)

**Signature**

\`\`\`ts
export type A = number
\`\`\`
`
    )
  })

  it("printModule", () => {
    const documentation = createNamedDoc(
      "tests",
      Option.none(),
      Option.some("1.0.0"),
      false,
      [],
      Option.none()
    )
    assert.strictEqual(
      _.printModule(
        createModule(
          documentation,
          ["src", "tests.ts"],
          [testCases.class],
          [testCases.interface],
          [testCases.function],
          [testCases.typeAlias],
          [testCases.constant],
          [testCases.export],
          []
        ),
        1
      ),
      `---
title: tests.ts
nav_order: 1
parent: Modules
---

## tests overview

Added in v1.0.0

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
  - [~~func~~](#func)
  - [test](#test-1)

---

# category

## A (class)

a class

**Signature**

\`\`\`ts
declare class A {
  constructor()
}
\`\`\`

**Example**

\`\`\`ts
example 1
\`\`\`

Added in v1.0.0

### staticTest (static method)

**Signature**

\`\`\`ts
static testStatic(): string;
\`\`\`

Added in v1.0.0

### hasOwnProperty (function) (method)

**Signature**

\`\`\`ts
hasOwnProperty(): boolean
\`\`\`

Added in v1.0.0

### foo (property)

**Signature**

\`\`\`ts
foo: string
\`\`\`

Added in v1.0.0

# constants

## test

the test

**Signature**

\`\`\`ts
declare const test: string
\`\`\`

Added in v1.0.0

# utils

## A (interface)

**Signature**

\`\`\`ts
export interface A extends Record<string, unknown> {}
\`\`\`

Added in v1.0.0

## A (type alias)

**Signature**

\`\`\`ts
export type A = number
\`\`\`

Added in v1.0.0

## ~~func~~

a function

**Signature**

\`\`\`ts
declare const func: (test: string) => string
\`\`\`

**Example**

\`\`\`ts
example 1
\`\`\`

Added in v1.0.0

## test

**Signature**

\`\`\`ts
export declare const test: typeof test
\`\`\`

Added in v1.0.0
`
    )

    const empty = createModule(
      documentation,
      ["src", "tests.ts"],
      [],
      [],
      [],
      [],
      [],
      [],
      []
    )

    assert.strictEqual(
      _.printModule(empty, 1),
      `---
title: tests.ts
nav_order: 1
parent: Modules
---

## tests overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

---
`
    )
  })
})
