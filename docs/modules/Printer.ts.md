---
title: Printer.ts
nav_order: 7
parent: Modules
---

## Printer overview

Since v0.6.0

---

## Exports Grouped by Category

- [printers](#printers)
  - [printModule](#printmodule)

---

# printers

## printModule

Description...

```ts
export const a: string = "a"
```

```text
┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐    ┌───────┐    ┌────────┐
│ input │───►│ func1 │───►│ func2 │───►│  ...  │───►│ funcN │───►│ result │
└───────┘    └───────┘    └───────┘    └───────┘    └───────┘    └────────┘
```

**Example** (Title 1)

```ts twoslash title="Title 1"
import { Domain, Printer } from "@effect/docgen"
import { Option } from "effect"

const doc = new Domain.Doc(undefined, "1.0.0", false, [], undefined)
const m = new Domain.Module("tests", doc, ["src", "tests.ts"], [], [], [], [], [], [], [])
console.log(Printer.printModule(m))
```

**Example** (Title 2)

```js twoslash title="Title 2"
export const a: string = "b"
```

**Throws**

`Error1` - Description 1
`Error2` - Description 2

**Signature**

```ts
export declare const printModule: (module: Domain.Module) => string
```

Since v0.6.0
